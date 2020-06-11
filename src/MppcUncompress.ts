import { Cast } from './Cast';
import { Buffer } from 'buffer';
import { ExtendedBuffer } from 'extended-buffer';

export class MppcUncompress {
    private cast: Cast;
    private code1: number;
    private code2: number;
    private code3: number;
    private code4: number;
    private packedOffset: number;
    private unpackedChunk: number[];
    private readonly packedBytes: number[];
    private readonly unpackedBytes: number[];

    public constructor() {
        this.cast = new Cast;
        this.packedBytes = [];
        this.unpackedChunk = [];
        this.unpackedBytes = (new Array<number>(8 * 1024)).fill(0);
        this.code1 = this.code2 = this.code3 = this.code4 = this.packedOffset = 0;
    }

    public update(data: Buffer): Buffer {
        this.unpackedChunk = [];

        for (let i = 0; i < data.length; ++i) {
            this.uncompress(data[i], this.unpackedChunk);
        }

        return Buffer.from(this.unpackedChunk);
    }

    protected hasBits(count: number): boolean {
        return (this.packedBytes.length * 8 - this.packedOffset) >= count;
    }

    /**
     * Return UInt32
     * @param bitCount [Int32]
     */
    protected getPackedBits(bitCount: number): number {
        if (bitCount > 16) {
            return 0;
        }

        if (!this.hasBits(bitCount)) {
            throw new Error('Unpack bit stream overflow');
        }

        let alBitCount = bitCount + this.packedOffset;
        let alByteCount = (alBitCount + 7) / 8;
        let v: number = 0; // UInt32

        for (let i = 0; i < alByteCount; ++i) {
            v |= this.cast.UInt8ToUInt32(this.packedBytes[i]) << (24 - i * 8);
        }

        v <<= this.packedOffset;
        v >>= 32 - bitCount;

        this.packedOffset += this.cast.Int32ToUInt8(bitCount);
        var freeBytes = this.packedOffset / 8;

        if (freeBytes !== 0) {
            this.packedBytes.splice(0, Math.floor(freeBytes));
        }

        this.packedOffset %= 8;
        return v < 0 ? this.cast.Int32ToUInt32(v) : v;
    }

    protected copy(shift: number, size: number, unpackedChunkData: number[]): void {
        for (let i = 0; i < size; ++i) {
            const pIndex = this.unpackedBytes.length - shift;

            if (pIndex < 0) {
                return;
            }

            const b = this.unpackedBytes[pIndex];
            this.unpackedBytes.push(b);
            unpackedChunkData.push(b);
        }
    }

    protected uncompress(packedByte: number, unpackedChunk: number[]): void {
        this.packedBytes.push(packedByte);

        if (this.unpackedBytes.length >= 10240) {
            this.unpackedBytes.splice(0, 2048);
        }

        for (;;)
        {
            if (this.code3 === 0)
            {
                if (this.hasBits(4))
                {
                    if (this.getPackedBits(1) === 0)
                    {
                        // 0-xxxxxxx
                        this.code1 = 1;
                        this.code3 = 1;
                    }
                    else
                    {
                        if (this.getPackedBits(1) === 0)
                        {
                            // 10-xxxxxxx
                            this.code1 = 2;
                            this.code3 = 1;
                        }
                        else
                        {
                            if (this.getPackedBits(1) === 0)
                            {
                                // 110-xxxxxxxxxxxxx-*
                                this.code1 = 3;
                                this.code3 = 1;
                            }
                            else
                            {
                                if (this.getPackedBits(1) === 0)
                                {
                                    // 1110-xxxxxxxx-*
                                    this.code1 = 4;
                                    this.code3 = 1;
                                }
                                else
                                {
                                    // 1111-xxxxxx-*
                                    this.code1 = 5;
                                    this.code3 = 1;
                                }
                            }
                        }
                    }
                }
                else
                    break;
            }
            else if (this.code3 === 1)
            {
                if (this.code1 === 1)
                {
                    if (this.hasBits(7))
                    {
                        const outB = this.cast.UInt32ToUInt8(this.getPackedBits(7));
                        unpackedChunk.push(outB);
                        this.unpackedBytes.push(outB);
                        this.code3 = 0;
                    }
                    else
                        break;
                }
                else if (this.code1 === 2)
                {
                    if (this.hasBits(7))
                    {
                        let _tmp = this.getPackedBits(7) | 0x80;
                        _tmp = _tmp < 0 ? this.cast.Int32ToUInt32(_tmp) : _tmp;

                        const outB = this.cast.UInt32ToUInt8(_tmp);
                        unpackedChunk.push(outB);
                        this.unpackedBytes.push(outB);
                        this.code3 = 0;
                    }
                    else
                        break;
                }
                else if (this.code1 === 3)
                {
                    if (this.hasBits(13))
                    {
                        this.code4 = this.cast.UInt32ToInt32(this.getPackedBits(13)) + 0x140;
                        this.code3 = 2;
                    }
                    else
                        break;
                }
                else if (this.code1 === 4)
                {
                    if (this.hasBits(8))
                    {
                        this.code4 = this.cast.UInt32ToInt32(this.getPackedBits(8)) + 0x40;
                        this.code3 = 2;
                    }
                    else
                        break;
                }
                else if (this.code1 === 5)
                {
                    if (this.hasBits(6))
                    {
                        this.code4 = this.cast.UInt32ToInt32(this.getPackedBits(6));
                        this.code3 = 2;
                    }
                    else
                        break;
                }
            }
            else if (this.code3 === 2)
            {
                if (this.code4 === 0)
                {
                    // Guess !!!
                    if (this.packedOffset !== 0)
                    {
                        this.packedOffset = 0;
                        this.packedBytes.splice(0, 1);
                    }
                    this.code3 = 0;
                    continue;
                }
                this.code2 = 0;
                this.code3 = 3;
            }
            else if (this.code3 === 3)
            {
                if (this.hasBits(1))
                {
                    if (this.getPackedBits(1) === 0)
                    {
                        this.code3 = 4;
                    }
                    else
                    {
                        this.code2++;
                    }
                }
                else
                    break;
            }
            else if (this.code3 === 4)
            {
                let copySize: number;

                if (this.code2 === 0)
                {
                    copySize = 3;
                }
                else
                {
                    const size = this.code2 + 1;

                    if (this.hasBits(size))
                    {
                        copySize = this.cast.UInt32ToInt32(this.getPackedBits(size)) + (1 << size);
                    }
                    else
                        break;
                }

                this.copy(this.code4, copySize, unpackedChunk);
                this.code3 = 0;
            }
        }
    }
}
