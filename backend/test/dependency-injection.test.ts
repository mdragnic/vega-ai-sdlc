import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

// T9: Nest resolves constructor dependencies by type, which needs decorator metadata (AC14).
@Injectable()
class Engine {
  start(): string {
    return 'started';
  }
}

@Injectable()
class Car {
  constructor(readonly engine: Engine) {}
}

describe('dependency injection in unit tests', () => {
  it('injects a service into another by its type', async () => {
    const moduleRef = await Test.createTestingModule({ providers: [Engine, Car] }).compile();

    const car = moduleRef.get(Car);

    expect(car.engine).toBeInstanceOf(Engine);
    expect(car.engine.start()).toBe('started');
  });
});
