// Copyright (c) 2015-2018 Robert Rypuła - https://audio-network.rypula.pl

import { Injector } from 'rr-tsdi';

import { LIST_FACTORY, SIMPLE_MATH } from './../../common';
import { PRECISION_DIGITS } from './../../di-token';
import { COMPLEX_DEPENDENCY_BAG, COMPLEX_FACTORY } from './../complex/di-token';
import { SIGNAL_FACTORY } from './di-token';

import { ListFactory, SimpleMath } from './../../common';

import { precisionDigits } from './../../settings';
import { ComplexDependencyBag } from './../complex/complex-dependency-bag';
import { ComplexFactory } from './../complex/complex-factory';
import { IComplexFactory } from './../complex/complex-factory.interface';
import { ISignalFactory } from './../signal/signal-factory.interface';
import { ISignal, ISignalDto } from './../signal/signal.interface';
import { SignalFactory } from './signal-factory';

describe('SignalFactory', () => {
  let signalFactory: ISignalFactory;
  let complexFactory: IComplexFactory;

  beforeEach(() => {
    const injector = new Injector();

    injector.registerService(COMPLEX_DEPENDENCY_BAG, ComplexDependencyBag);
    injector.registerValue(PRECISION_DIGITS, precisionDigits);
    injector.registerService(COMPLEX_FACTORY, ComplexFactory);
    injector.registerService(SIMPLE_MATH, SimpleMath);
    injector.registerService(LIST_FACTORY, ListFactory);
    injector.registerService(SIGNAL_FACTORY, SignalFactory);

    signalFactory = injector.get(SIGNAL_FACTORY);
    complexFactory = injector.get(COMPLEX_FACTORY);
  });

  it('should create proper instance', () => {
    expect(signalFactory).toBeInstanceOf(SignalFactory);
  });

  it('should create a complex list from ComplexList DTO', () => {
    const signalDto = [
      { real: 1, imaginary: 2 },
      { real: 3, imaginary: 4 }
    ];
    const signal = signalFactory.fromDto(signalDto);

    expect(signal.getSize()).toBe(2);

    expect(signal.getAt(0).getReal()).toBe(signalDto[0].real);
    expect(signal.getAt(0).getImaginary()).toBe(signalDto[0].imaginary);

    expect(signal.getAt(1).getReal()).toBe(signalDto[1].real);
    expect(signal.getAt(1).getImaginary()).toBe(signalDto[1].imaginary);
  });

  it('should create a complex list from raw IQ data', () => {
    const rawIQ = [1, 2, 3, 4];
    let signal = signalFactory.fromRawIQ(rawIQ);

    expect(signal.getSize()).toBe(2);

    expect(signal.getAt(0).getReal()).toBe(rawIQ[0]);
    expect(signal.getAt(0).getImaginary()).toBe(rawIQ[1]);

    expect(signal.getAt(1).getReal()).toBe(rawIQ[2]);
    expect(signal.getAt(1).getImaginary()).toBe(rawIQ[3]);

    rawIQ.push(5);
    expect(() => {
      signal = signalFactory.fromRawIQ(rawIQ);
    }).toThrow();
  });

  it('should convert complex list into ComplexList DTO', () => {  // TODO refactor me - move to Signal class
    const signal: ISignal = signalFactory.create(2);
    let signalDto: ISignalDto;

    signal.append(complexFactory.create(1, 2));
    signal.append(complexFactory.create(3, 4));

    signalDto = signalFactory.toDto(signal);

    expect(signalDto).toEqual(
      [
        { real: 1, imaginary: 2 },
        { real: 3, imaginary: 4 }
      ]
    );
  });

  it('should convert complex list into raw IQ data', () => {  // TODO refactor me - move to Signal class
    const signal: ISignal = signalFactory.create(2);
    let rawIQ: number[];

    signal.append(complexFactory.create(1, 2));
    signal.append(complexFactory.create(3, 4));

    rawIQ = signalFactory.toRawIQ(signal);

    expect(rawIQ).toEqual([1, 2, 3, 4]);
  });

  it('should properly indicate that two lists are equal', () => {  // TODO refactor me - move to Signal class
    const a = signalFactory.fromRawIQ([1, 2, 3, 4.000000]);
    const b = signalFactory.fromRawIQ([1, 2, 3, 4.000000]);
    const c = signalFactory.fromRawIQ([1, 2, 3, 4.0000001]);
    const d = signalFactory.fromRawIQ([1, 2, 3, 4.000001]);
    const e = signalFactory.fromRawIQ([1, 2]);
    const emptyA = signalFactory.fromRawIQ([]);
    const emptyB = signalFactory.fromRawIQ([]);

    expect(signalFactory.isEqual(a, b)).toBe(true);
    expect(signalFactory.isEqual(a, c)).toBe(true);
    expect(signalFactory.isEqual(a, d)).toBe(false);
    expect(signalFactory.isEqual(a, e)).toBe(false);
    expect(signalFactory.isEqual(emptyA, emptyB)).toBe(true);
  });
});
