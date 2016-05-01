'use strict';

var 
    anpl = null,
    anplDestroyInProgress = false,
    transmitAdapter = null,
    receiveAdapter = null
;

function onLoad() {
    collectSettingsAndInit();
    setupCpuLoadNotification();
}

function setupCpuLoadNotification() {
    var rxLoad, txLoad;

    rxLoad = document.getElementById('load-rx');
    txLoad = document.getElementById('load-tx');

    setInterval(function () {
        if (anpl && !anplDestroyInProgress) {
            rxLoad.innerHTML = Math.round(anpl.getRxCpuLoadData().load * 100);
            txLoad.innerHTML = Math.round(anpl.getTxCpuLoadData().load * 100);
        }
    }, 200);
}

function quickConfigure(channelNumber, pskSize, baud, ofdmSize) {
    var
        ofdmSpacing, symbolAndGuardTime, config, i, element,
        symbolBaudFactor = 0.32,
        guardBaudFactor = 0.68
    ;

    if (channelNumber < 1 || channelNumber > 2) {
        throw 'Not supported quickConfiguration parameters';
    }

    symbolAndGuardTime = 1.0 / baud;
    ofdmSpacing = 4 / symbolAndGuardTime;// [wikipedia] sub-carrier spacing is k/TU Hertz, where TU seconds
                                         // is the useful symbol duration (the receiver side window size),
                                         // and k is a positive integer, typically equal to 1

    document.getElementById('rx-dft-time-span').value = Math.round(symbolBaudFactor * symbolAndGuardTime * 1000);
    document.getElementById('symbol-duration').value = Math.round(symbolBaudFactor * symbolAndGuardTime * 1000);
    document.getElementById('guard-interval').value = Math.round(guardBaudFactor * symbolAndGuardTime * 1000);
    document.getElementById('interpacket-gap').value = Math.round(3 * guardBaudFactor * symbolAndGuardTime * 1000);

    if (channelNumber === 1) {
        config = '1070-' + ofdmSize + '-' + ofdmSpacing;
        document.getElementById('tx-channel-config').value = config;
        document.getElementById('rx-channel-config').value = config;
    } else {
        config = '1070-' + ofdmSize + '-' + ofdmSpacing + ' ' + '2025-' + ofdmSize + '-' + ofdmSpacing;
        document.getElementById('tx-channel-config').value = config;
        document.getElementById('rx-channel-config').value = config;
    }

    collectSettingsAndInit(function () {
        for (i = 0; i < anpl.getRxChannelSize(); i++) {
            element = document.getElementById('rx-psk-size-' + i);
            element.value = pskSize;
            element.onchange();
        }
        for (i = 0; i < anpl.getTxChannelSize(); i++) {
            element = document.getElementById('tx-psk-size-' + i);
            element.value = pskSize;
            element.onchange();
        }
    });
}

function collectSettingsAndInit(cb) {
    var
        txChannel = [],
        rxChannel = [],
        txRx = [],
        dftTimeSpan,
        notificationPerSecond,
        rxSpectrumVisible, rxConstellationDiagramVisible,
        enabled,
        value, channelDataList, channelData, i, j;

    txRx.push({
        id: 'tx',
        data: txChannel
    });
    txRx.push({
        id: 'rx',
        data: rxChannel
    });

    for (i = 0; i < txRx.length; i++) {
        value = getStrById(txRx[i].id + '-channel-config');
        enabled = !!document.getElementById(txRx[i].id + '-enabled').checked;
        channelDataList = value === '' || !enabled ? [] : (value).split(' ');
        for (j = 0; j < channelDataList.length; j++) {
            channelData = channelDataList[j].split('-');
            txRx[i].data.push({
                baseFrequency: parseFloat(channelData[0]),
                ofdmSize: parseInt(channelData[1]),
                ofdmFrequencySpacing: parseFloat(channelData[2])
            });
        }
    }

    rxSpectrumVisible = !!document.getElementById('rx-spectrum-visible').checked;
    rxConstellationDiagramVisible = !!document.getElementById('rx-constellation-diagram-visible').checked;
    dftTimeSpan = getFloatById('rx-dft-time-span');
    notificationPerSecond = getIntById('rx-notification-per-second');

    destroy(function () {
        initialize(txChannel, rxChannel, rxSpectrumVisible, rxConstellationDiagramVisible, notificationPerSecond, dftTimeSpan);

        if (typeof cb === 'function') {
            cb();
        }
    });
}

function initialize(txChannel, rxChannel, rxSpectrumVisible, rxConstellationDiagramVisible, notificationPerSecond, dftTimeSpan) {
    generateHtml(txChannel, rxChannel);

    anpl = new AudioNetworkPhysicalLayer({
        tx: {
            channel: txChannel
        },
        rx: {
            channel: rxChannel,
            notificationPerSecond: notificationPerSecond, // default: 20
            dftTimeSpan: dftTimeSpan / 1000, // default: 0.1
            spectrum: {
                elementId: rxSpectrumVisible ? 'rx-spectrum' : null,
                height: 150,
                color: {
                    axis: '#999',
                    data: '#FAA61A'
                }
            },
            constellationDiagram: {
                color: {
                    axis: '#43B581'
                },
                elementId: (
                    rxConstellationDiagramVisible ?
                    'rx-constellation-diagram-{{ channelIndex }}-{{ ofdmIndex }}' :
                    null
                ),
                width: 140,
                height: 140,
                historyPointSize: notificationPerSecond // default: 20
            }
        }
    });
    transmitAdapter = new AudioNetworkTransmitAdapter(anpl);
    receiveAdapter = new AudioNetworkReceiveAdapter(anpl);

    var powerChartQueue0 = new Queue(400);
    //var powerChart0 = new PowerChart(document.getElementById('rx-power-chart-0'), 400, 2 * 80, powerChartQueue0);

    anpl.rx(function (channelIndex, carrierDetail, time) {
        var element = document.getElementById('rx-sampling-state-v2-' + channelIndex);  // TODO refactor this
        var receiveData;

        if (powerChartQueue0.isFull()) {
            powerChartQueue0.pop()
        }
        powerChartQueue0.push(carrierDetail[0].powerDecibel);

        receiveData = receiveAdapter.receive(channelIndex, carrierDetail, time); // receive (higher level)
        element.innerHTML = receiveData.state + ' ' + receiveData.power;

        receive(channelIndex, carrierDetail, time); // rx (lowest level)
    });
    receiveAdapter.setPacketReceiveHandler(function (channelIndex, data) {
        var str, i, uiPacketHistory = document.getElementById('rx-sampling-packet-history-' + channelIndex);

        str = '';
        for (i = 0; i < data.length; i++) {
            str += (typeof data[i] === 'number' ? data[i] : data[i].join(', ')) + ' | ';
        }
        uiPacketHistory.innerHTML = str + '&nbsp;<br/>' + uiPacketHistory.innerHTML;
    });
    receiveAdapter.setFrequencyUpdateHandler(function (channelIndex, data) {
        console.log('freq update');
        uiRefresh();
    });
    receiveAdapter.setPhaseCorrectionUpdateHandler(function (channelIndex, data) {
        console.log('phase update');
        uiRefresh();
    });

    initializeHtml();
}


function destroy(cb) {
    if (anpl) {
        anplDestroyInProgress = true;
        anpl.destroy().then(function () {
            transmitAdapter = null;
            receiveAdapter = null;
            anpl = null;
            document.getElementById('tx-channel-container').innerHTML = '';
            document.getElementById('rx-channel-container').innerHTML = '';

            anplDestroyInProgress = false;
            if (typeof cb === 'function') {
                cb();
            }
        });
    } else {
        if (typeof cb === 'function') {
            cb();
        }        
    }
}

function receiveAdapterReset(channelIndex) {
    var uiPacketHistory = document.getElementById('rx-sampling-packet-history-' + channelIndex);

    receiveAdapter.reset(channelIndex);
    uiPacketHistory.innerHTML = '';
}

function frequencyUpdate(rxTx, channelIndex, ofdmIndex) {
    var elementId, newFrequency;

    elementId = rxTx + '-frequency-input-' + channelIndex + '-' + ofdmIndex;
    newFrequency = getFloatById(elementId);

    if (rxTx === 'tx') {
        anpl.setTxFrequency(channelIndex, ofdmIndex, newFrequency);
    } else {
        anpl.setRxFrequency(channelIndex, ofdmIndex, newFrequency);
    }

    uiRefresh();
}

function phaseCorrectionUpdate(rxTx, channelIndex, ofdmIndex) {
    var elementId, newFrequency;

    elementId = rxTx + '-phase-correction-input-' + channelIndex + '-' + ofdmIndex;
    newFrequency = getFloatById(elementId);

    if (rxTx === 'tx') {
        anpl.setTxPhaseCorrection(channelIndex, ofdmIndex, newFrequency);
    } else {
        anpl.setRxPhaseCorrection(channelIndex, ofdmIndex, newFrequency);
    }

    uiRefresh();
}

function rxInput(type) {
    var refresh = true;

    switch (type) {
        case 'mic':
            anpl.setRxInput(AudioNetworkPhysicalLayerConfiguration.INPUT.MICROPHONE);
            break;
        case 'tx':
            anpl.setRxInput(AudioNetworkPhysicalLayerConfiguration.INPUT.TX);
            break;
        case 'rec':
            anpl.setRxInput(AudioNetworkPhysicalLayerConfiguration.INPUT.RECORDED_AUDIO);
            break;
        default:
            refresh = false;
    }

    if (refresh) {
        uiRefresh();
    }
}

function loadRecordedAudio() {
    anpl.loadRecordedAudio(
        getStrById('recorded-audio-url'),
        function () {
            anpl.setRxInput(AudioNetworkPhysicalLayerConfiguration.INPUT.RECORDED_AUDIO);
            anpl.outputRecordedAudioEnable();
            uiRefresh();
        },
        function () {
            alert('Error');
        }
    );
}

function output(type, state) {
    var refresh = true;

    switch (type) {
        case 'tx':
            if (state) {
                anpl.outputTxEnable();
            } else {
                anpl.outputTxDisable();
            }
            break;
        case 'mic':
            if (state) {
                anpl.outputMicrophoneEnable();
            } else {
                anpl.outputMicrophoneDisable();
            }
            break;
        case 'rec':
            if (state) {
                anpl.outputRecordedAudioEnable();
            } else {
                anpl.outputRecordedAudioDisable();
            }
            break;
        default:
            refresh = false;
    }

    if (refresh) {
        uiRefresh();
    }
}

function symbolDurationChange() {
    var value = getIntById('symbol-duration');

    receiveAdapter.setSymbolDuration(value);
    uiRefresh();
}

function guardIntervalChange() {
    var value = getIntById('guard-interval');

    receiveAdapter.setGuardInterval(value);
    uiRefresh();
}

function syncPreambleChange() {
    var value = !!document.getElementById('sync-preamble').checked;

    receiveAdapter.setSyncPreamble(value);
    uiRefresh();
}

function pskSizeChange(channelIndex) {
    var value = getIntById('rx-psk-size-' + channelIndex);

    receiveAdapter.setPskSize(channelIndex, value);
    uiRefreshOnPskSizeChange('rx', channelIndex);
}
