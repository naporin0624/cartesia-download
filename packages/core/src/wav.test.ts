import { describe, it, expect } from 'vitest';
import { buildWavHeader } from './wav';

describe('buildWavHeader', () => {
  const defaultParams = {
    dataByteLength: 1000,
    sampleRate: 44100,
    numChannels: 1,
    bitsPerSample: 16,
  };

  it('returns exactly 44 bytes', () => {
    const header = buildWavHeader(defaultParams);
    expect(header.length).toBe(44);
  });

  it('writes RIFF magic bytes at offset 0', () => {
    const header = buildWavHeader(defaultParams);
    expect(header[0]).toBe(0x52); // 'R'
    expect(header[1]).toBe(0x49); // 'I'
    expect(header[2]).toBe(0x46); // 'F'
    expect(header[3]).toBe(0x46); // 'F'
  });

  it('writes WAVE magic bytes at offset 8', () => {
    const header = buildWavHeader(defaultParams);
    expect(header[8]).toBe(0x57); // 'W'
    expect(header[9]).toBe(0x41); // 'A'
    expect(header[10]).toBe(0x56); // 'V'
    expect(header[11]).toBe(0x45); // 'E'
  });

  it('writes fmt chunk marker at offset 12', () => {
    const header = buildWavHeader(defaultParams);
    expect(header[12]).toBe(0x66); // 'f'
    expect(header[13]).toBe(0x6d); // 'm'
    expect(header[14]).toBe(0x74); // 't'
    expect(header[15]).toBe(0x20); // ' '
  });

  it('writes data chunk marker at offset 36', () => {
    const header = buildWavHeader(defaultParams);
    expect(header[36]).toBe(0x64); // 'd'
    expect(header[37]).toBe(0x61); // 'a'
    expect(header[38]).toBe(0x74); // 't'
    expect(header[39]).toBe(0x61); // 'a'
  });

  it('writes correct ChunkSize (36 + dataByteLength) as little-endian uint32 at offset 4', () => {
    const dataByteLength = 1000;
    const header = buildWavHeader({ ...defaultParams, dataByteLength });
    const chunkSize = header.readUInt32LE(4);
    expect(chunkSize).toBe(36 + dataByteLength);
  });

  it('writes correct ByteRate (sampleRate * numChannels * bitsPerSample / 8) at offset 28', () => {
    const params = { dataByteLength: 500, sampleRate: 22050, numChannels: 2, bitsPerSample: 16 };
    const header = buildWavHeader(params);
    const byteRate = header.readUInt32LE(28);
    expect(byteRate).toBe((22050 * 2 * 16) / 8); // 88200
  });

  it('writes correct BlockAlign (numChannels * bitsPerSample / 8) as little-endian uint16 at offset 32', () => {
    const params = { dataByteLength: 500, sampleRate: 44100, numChannels: 2, bitsPerSample: 24 };
    const header = buildWavHeader(params);
    const blockAlign = header.readUInt16LE(32);
    expect(blockAlign).toBe((2 * 24) / 8); // 6
  });

  it('writes PCM AudioFormat (1) as little-endian uint16 at offset 20', () => {
    const header = buildWavHeader(defaultParams);
    const audioFormat = header.readUInt16LE(20);
    expect(audioFormat).toBe(1);
  });

  it('produces a known-good header for sampleRate=44100, numChannels=1, bitsPerSample=16, dataByteLength=1000', () => {
    const header = buildWavHeader({
      dataByteLength: 1000,
      sampleRate: 44100,
      numChannels: 1,
      bitsPerSample: 16,
    });

    // RIFF
    expect(header.subarray(0, 4).toString('ascii')).toBe('RIFF');
    // ChunkSize = 36 + 1000 = 1036
    expect(header.readUInt32LE(4)).toBe(1036);
    // WAVE
    expect(header.subarray(8, 12).toString('ascii')).toBe('WAVE');
    // fmt
    expect(header.subarray(12, 16).toString('ascii')).toBe('fmt ');
    // SubChunk1Size = 16
    expect(header.readUInt32LE(16)).toBe(16);
    // AudioFormat = 1 (PCM)
    expect(header.readUInt16LE(20)).toBe(1);
    // NumChannels = 1
    expect(header.readUInt16LE(22)).toBe(1);
    // SampleRate = 44100
    expect(header.readUInt32LE(24)).toBe(44100);
    // ByteRate = 44100 * 1 * 16 / 8 = 88200
    expect(header.readUInt32LE(28)).toBe(88200);
    // BlockAlign = 1 * 16 / 8 = 2
    expect(header.readUInt16LE(32)).toBe(2);
    // BitsPerSample = 16
    expect(header.readUInt16LE(34)).toBe(16);
    // data
    expect(header.subarray(36, 40).toString('ascii')).toBe('data');
    // SubChunk2Size = 1000
    expect(header.readUInt32LE(40)).toBe(1000);
  });
});
