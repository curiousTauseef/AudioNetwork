// Copyright (c) 2015-2017 Robert Rypuła - https://audio-network.rypula.pl
'use strict';

var
    ASCII_NULL = 0,
    RAW_SYMBOL_MAX = 10,
    dataLinkLayerBuilder,
    dataLinkLayer,
    rxSymbolRawHistory = new Buffer(RAW_SYMBOL_MAX);

function init() {
    dataLinkLayerBuilder = new DataLinkLayerBuilder();
    dataLinkLayer = dataLinkLayerBuilder
        .frameListener(frameListener)
        .frameCandidateListener(frameCandidateListener)
        .txListener(txListener)
        .rxSampleListener(rxSampleListener)
        .configListener(configListener)
        .txConfigListener(txConfigListener)
        .rxConfigListener(rxConfigListener)
        .build();
}

function frameListener(frame) {
    var commandName = '', htmlContent = '';

    if (frame.isCommand) {
        switch (frame.payload[0]) {
            case DataLinkLayer.COMMAND_TWO_WAY_SYNC_44100:
                commandName = 'COMMAND_TWO_WAY_SYNC_44100';
                break;
            case DataLinkLayer.COMMAND_TWO_WAY_SYNC_48000:
                commandName = 'COMMAND_TWO_WAY_SYNC_48000';
                break;
        }
    }

    htmlContent += '<div class="rx-box-with-border">';
    // htmlContent += '<strong>Id:</strong> ' + fc.id + '<br/>';
    // htmlContent += '<strong>Progress:</strong> ' + progress + '<br/>';
    htmlContent += '<div>' + getByteHexFromByteList(frame.payload) + '</div>';
    htmlContent += '<div>' + getAsciiFromByteList(frame.payload) + '</div>';
    // htmlContent += '<strong>IsValid:</strong> ' + (fc.isValid ? 'yes' : 'no') + '<br/>';
    // htmlContent += '<strong>SymbolId:</strong> ' + fc.symbolId.join(', ') + '<br/>';
    htmlContent += '</div>';

    html('#rx-frame', htmlContent, true);
}

function frameCandidateListener(frameCandidateList) {
    var i, fc, progress, htmlContent = '';

    for (i = 0; i < frameCandidateList.length; i++) {
        fc = frameCandidateList[i];
        progress = (100 * fc.received.length / fc.expected).toFixed(0);
        htmlContent += '<div class="rx-box-with-border">';
        htmlContent += '<div class="rx-process-bar"><div style="width: ' + progress + '%"></div></div>';
        // htmlContent += '<strong>Id:</strong> ' + fc.id + '<br/>';
        // htmlContent += '<strong>Progress:</strong> ' + progress + '<br/>';
        htmlContent += '<div>' + getByteHexFromByteList(fc.received) + '</div>';
        htmlContent += '<div>' + getAsciiFromByteList(fc.received) + '</div>';
        // htmlContent += '<strong>IsValid:</strong> ' + (fc.isValid ? 'yes' : 'no') + '<br/>';
        // htmlContent += '<strong>SymbolId:</strong> ' + fc.symbolId.join(', ') + '<br/>';
        htmlContent += '</div>';
    }

    html('#rx-frame-candidate', htmlContent);
}

function txListener(state) {
    var
        txConfig = dataLinkLayer.getPhysicalLayer().getTxConfig(),
        symbolMin = txConfig.symbolMin,
        txByteHex = state.symbol
            ? getByteHexFromSymbol(state.symbol, symbolMin)
            : 'idle',
        txByteHexQueue = getByteHexFromSymbolList(state.symbolQueue, symbolMin);

    html('#tx-byte-hex', txByteHex);
    html('#tx-byte-hex-queue', txByteHexQueue);
}

function rxSampleListener(state) {
    var
        rxConfig = dataLinkLayer.getPhysicalLayer().getRxConfig(),
        symbolMin = rxConfig.symbolMin;

    html('#sync', state.syncId === null ? 'waiting for sync...' : 'OK');
    html('#sync-in-progress', state.isSyncInProgress ? '[sync in progress]' : '');

    if (state.isSymbolSamplingPoint) {
        rxSymbolRawHistory.pushEvenIfFull(state.symbolRaw);
        html('#rx-byte-raw-history', getByteHexFromSymbolList(rxSymbolRawHistory.getAll(), symbolMin));
    }
}

function configListener(state) {
    setActive(
        '#loopback-container',
        '#loopback-' + (state.isLoopbackEnabled ? 'enabled' : 'disabled')
    );
}

function txConfigListener(state) {
    setActive('#tx-sample-rate-container', '#tx-sample-rate-' + state.sampleRate);
}

function rxConfigListener(state) {
    html('#rx-sample-rate', (state.sampleRate / 1000).toFixed(1));
}

// ---------

function onSendTwoWaySyncClick() {
    dataLinkLayer.txTwoWaySync();
}

function onTxSampleRateClick(txSampleRate) {
    dataLinkLayer.setTxSampleRate(txSampleRate);
}

function onLoopbackClick(state) {
    dataLinkLayer.setLoopback(state);
}

function onSendHexClick() {
    var
        textSplit = getFormFieldValue('#tx-data', 'split'),
        payload = [],
        byte,
        i;

    for (i = 0; i < textSplit.length; i++) {
        byte = parseInt(textSplit[i], 16);
        if (0 <= byte && byte <= 255) {
            payload.push(byte);
        }
    }
    sendFrame(payload);
}

function onSendAsciiClick() {
    var
        text = getFormFieldValue('#tx-data'),
        payload = [],
        byte,
        i;

    for (i = 0; i < text.length; i++) {
        byte = isPrintableAscii(text[i])
            ? text.charCodeAt(i)
            : ASCII_NULL;
        payload.push(byte);
    }
    sendFrame(payload);
}

function sendFrame(payload) {
    try {
        dataLinkLayer.sendFrame(payload);
    } catch (e) {
        alert(e);
    }
}
