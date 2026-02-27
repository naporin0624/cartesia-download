import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: vi.fn(),
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn(),
  StreamType: { Arbitrary: 'arbitrary' },
  AudioPlayerStatus: { Idle: 'idle', Playing: 'playing' },
  VoiceConnectionStatus: { Ready: 'ready' },
  NoSubscriberBehavior: { Pause: 'pause' },
}));

import { joinVoiceChannel } from '@discordjs/voice';
import { createConnectionManager } from './connection-manager';

const makeFakeConnection = () => ({
  destroy: vi.fn(),
  subscribe: vi.fn(),
  on: vi.fn(),
  state: { status: 'ready' },
});

describe('createConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('join', () => {
    it('calls joinVoiceChannel with correct params', () => {
      const manager = createConnectionManager();
      const fakeConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValue(fakeConnection);

      const adapterCreator = vi.fn();
      manager.join('guild-1', 'channel-1', adapterCreator);

      expect(joinVoiceChannel).toHaveBeenCalledWith({
        guildId: 'guild-1',
        channelId: 'channel-1',
        adapterCreator,
      });
    });

    it('stores connection retrievable by getConnection', () => {
      const manager = createConnectionManager();
      const fakeConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValue(fakeConnection);

      manager.join('guild-1', 'channel-1', vi.fn());
      const result = manager.getConnection('guild-1');

      expect(result).toBe(fakeConnection);
    });

    it('returns the new connection', () => {
      const manager = createConnectionManager();
      const fakeConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValue(fakeConnection);

      const result = manager.join('guild-1', 'channel-1', vi.fn());

      expect(result).toBe(fakeConnection);
    });

    it('destroys previous connection when joining same guild again', () => {
      const manager = createConnectionManager();
      const firstConnection = makeFakeConnection();
      const secondConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValueOnce(firstConnection).mockReturnValueOnce(secondConnection);

      manager.join('guild-1', 'channel-1', vi.fn());
      manager.join('guild-1', 'channel-2', vi.fn());

      expect(firstConnection.destroy).toHaveBeenCalledTimes(1);
    });

    it('stores new connection after second join to same guild', () => {
      const manager = createConnectionManager();
      const firstConnection = makeFakeConnection();
      const secondConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValueOnce(firstConnection).mockReturnValueOnce(secondConnection);

      manager.join('guild-1', 'channel-1', vi.fn());
      manager.join('guild-1', 'channel-2', vi.fn());

      expect(manager.getConnection('guild-1')).toBe(secondConnection);
    });
  });

  describe('getConnection', () => {
    it('returns undefined for unknown guild', () => {
      const manager = createConnectionManager();

      const result = manager.getConnection('nonexistent-guild');

      expect(result).toBeUndefined();
    });

    it('returns undefined after leaving a guild', () => {
      const manager = createConnectionManager();
      const fakeConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValue(fakeConnection);

      manager.join('guild-1', 'channel-1', vi.fn());
      manager.leave('guild-1');

      expect(manager.getConnection('guild-1')).toBeUndefined();
    });
  });

  describe('leave', () => {
    it('destroys connection and returns true when guild exists', () => {
      const manager = createConnectionManager();
      const fakeConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValue(fakeConnection);

      manager.join('guild-1', 'channel-1', vi.fn());
      const result = manager.leave('guild-1');

      expect(fakeConnection.destroy).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('returns false for unknown guild', () => {
      const manager = createConnectionManager();

      const result = manager.leave('nonexistent-guild');

      expect(result).toBe(false);
    });

    it('removes connection from map so getConnection returns undefined', () => {
      const manager = createConnectionManager();
      const fakeConnection = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValue(fakeConnection);

      manager.join('guild-1', 'channel-1', vi.fn());
      manager.leave('guild-1');

      expect(manager.getConnection('guild-1')).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('destroys all connections', () => {
      const manager = createConnectionManager();
      const connection1 = makeFakeConnection();
      const connection2 = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValueOnce(connection1).mockReturnValueOnce(connection2);

      manager.join('guild-1', 'channel-1', vi.fn());
      manager.join('guild-2', 'channel-2', vi.fn());
      manager.destroy();

      expect(connection1.destroy).toHaveBeenCalledTimes(1);
      expect(connection2.destroy).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no connections exist', () => {
      const manager = createConnectionManager();

      expect(() => manager.destroy()).not.toThrow();
    });

    it('leaves all connections unreachable after destroy', () => {
      const manager = createConnectionManager();
      const connection1 = makeFakeConnection();
      (joinVoiceChannel as unknown as MockInstance).mockReturnValue(connection1);

      manager.join('guild-1', 'channel-1', vi.fn());
      manager.destroy();

      expect(manager.getConnection('guild-1')).toBeUndefined();
    });
  });
});
