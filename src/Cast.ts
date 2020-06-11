import { Buffer } from 'buffer';

export class Cast {
    protected buffer: Buffer;

    public constructor() {
        this.buffer = Buffer.allocUnsafe(8);
    }

    public Int32ToUInt32(value: number): number {
        this.buffer.fill(0).writeInt32LE(value);
        return this.buffer.readUInt32LE();
    }

    public UInt32ToInt32(value: number): number {
        this.buffer.fill(0).writeUInt32LE(value);
        return this.buffer.readInt32LE();
    }

    public UInt8ToUInt32(value: number): number {
        this.buffer.fill(0).writeUInt8(value);
        return this.buffer.readUInt32LE();
    }

    public Int32ToUInt8(value: number): number {
        this.buffer.fill(0).writeInt32LE(value);
        return this.buffer.readUInt8();
    }

    public UInt32ToUInt8(value: number): number {
        this.buffer.fill(0).writeUInt32LE(value);
        return this.buffer.readUInt8();
    }
}
