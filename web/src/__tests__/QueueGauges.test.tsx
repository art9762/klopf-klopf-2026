import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueueGauges } from '../components/QueueGauges';

describe('QueueGauges', () => {
  it('renders zero state', () => {
    render(<QueueGauges queues={null} />);
    expect(screen.getByText('Queue Status')).toBeDefined();
    expect(screen.getByText('Side A')).toBeDefined();
    expect(screen.getByText('Side B')).toBeDefined();
  });

  it('renders queue values', () => {
    render(
      <QueueGauges
        queues={{ ts: 1000, queue_A: 7, queue_B: 12, wait_A_sec: 22, wait_B_sec: 34 }}
      />
    );
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });
});
