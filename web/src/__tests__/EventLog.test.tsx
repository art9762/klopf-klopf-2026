import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventLog } from '../components/EventLog';

describe('EventLog', () => {
  it('renders empty state', () => {
    render(<EventLog events={[]} />);
    expect(screen.getByText('No events yet')).toBeDefined();
  });

  it('renders events', () => {
    const events = [
      { ts: 1000, level: 'info' as const, code: 'TEST', msg: 'hello world' },
      { ts: 1001, level: 'warn' as const, code: 'WARN', msg: 'something happened' },
    ];
    render(<EventLog events={events} />);
    expect(screen.getByText('hello world')).toBeDefined();
    expect(screen.getByText('something happened')).toBeDefined();
  });

  it('groups duplicate messages', () => {
    const events = [
      { ts: 1000, level: 'warn' as const, code: 'DUP', msg: 'repeated msg' },
      { ts: 1001, level: 'warn' as const, code: 'DUP', msg: 'repeated msg' },
      { ts: 1002, level: 'warn' as const, code: 'DUP', msg: 'repeated msg' },
    ];
    render(<EventLog events={events} />);
    expect(screen.getByText('x3')).toBeDefined();
  });

  it('does not group different messages', () => {
    const events = [
      { ts: 1000, level: 'info' as const, code: 'A', msg: 'first' },
      { ts: 1001, level: 'info' as const, code: 'B', msg: 'second' },
    ];
    render(<EventLog events={events} />);
    expect(screen.getByText('first')).toBeDefined();
    expect(screen.getByText('second')).toBeDefined();
    expect(screen.queryByText(/x\d/)).toBeNull();
  });
});
