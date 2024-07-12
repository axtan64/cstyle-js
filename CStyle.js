// C-Style data structures, made into JavaScript, by axtan64
// https://github.com/axtan64

const structs = {};
const BYTE_LEN = 8;
const BYTE_SIZE = 2 ** BYTE_LEN;

/**
 * A class that represents a primitive data types
 */

class CType {
    /**
     * Create a new data type
     * @param {String} name name of the new data type (e.g. int, bool, etc.)
     * @param {number} size how big the data type is in bits
     * @param {*} serialize given an instance of this data type, this function converts it to an array of bytes
     * @param {*} deserialize  given an array of bytes, this function converts it to an instance of this data type
     */
    constructor(name, size, serialize=((data) => new Uint8Array([data % BYTE_SIZE])), deserialize=((bytes) => bytes[0])) {
        if(!name || !size) throw new Error(`Invalid name or size passed to CType constructor. Name: ${name}, ${size}`);
        this.enum = Symbol(name);
        this.size = size;
        this.serialize = serialize;
        this.deserialize = deserialize;
    }
}

/**
 * Similar to a C-Style struct, but operates on a bit-level to allow for more versatility.
 * All structs created are put into the structs object for re-use.
 */

class Struct extends CType {
    /**
     * Create a new struct type
     * @param {String} name name of the struct
     * @param {*} members an array of pairs in the format [[memberName1, CType1], [memberName2, CType2], ...]
     */
    constructor(name, members=[]) {
        // members: [[memberName, CType]]}

        super(name, members.reduce((size, member) => size + member[1].size, 0));

        this.serialize = (object) => {
            let serialized = new Uint8Array(Math.ceil(this.size / BYTE_LEN));
            let i = 0; // points to next bit that needs filling with a member

            members.forEach((member) => {
                insertBuffer(
                    member[1].serialize(object[member[0]]), 
                    serialized, 
                    i, 
                    mod(BYTE_LEN - member[1].size, BYTE_LEN)
                );
                i += member[1].size;
            });

            return serialized;
        }

        this.deserialize = (bytes) => toObject(this, bytes, 0);

        this.members = members;
        structs[name] = this;
    }
}

const cvar = Object.freeze({
    uint4: new CType("uint4", 4),
    uint8: new CType("uint8", 8),
    int32: new CType("int32", 32,
        (int) => new Uint8Array([
            (int >> (BYTE_LEN) * 3) % BYTE_SIZE,
            (int >> (BYTE_LEN) * 2) % BYTE_SIZE,
            (int >> (BYTE_LEN) * 1) % BYTE_SIZE,
            (int) % BYTE_SIZE
        ]),
        (bytes) => bytes[3] + (bytes[2] << (BYTE_LEN * 1)) + (bytes[1] << (BYTE_LEN * 2)) + (bytes[0] << (BYTE_LEN * 3))
    ),
    bigint: new CType("bigint", 64,
        (bigint) => {
            let serialized = new Uint8Array(8);
            let m = BigInt(BYTE_SIZE);

            for (let i = 7; i >= 0; i--) {
                serialized[i] = Number(bigint % m);
                bigint = bigint / m; // bigints are automatically integer divison, so it works
            }

            return serialized;
        },
        (bytes) => {
            let bigint = 0n;
            let j = 0;

            for(let i = bytes.length - 1; i >= 0; i--, j++) {
                bigint += BigInt(bytes[i]) << BigInt(j * BYTE_LEN);
            }

            return bigint;
        }
    ),
    char: new CType("char", 16,
        (char) => new Uint8Array([char.charCodeAt(0) >> BYTE_LEN, char.charCodeAt(0) % BYTE_SIZE]),
        (bytes) => String.fromCharCode((bytes[0] << BYTE_LEN) + bytes[1])
    ),
    boolean: new CType("boolean", 1,
        (bool) => new Uint8Array([bool ? 1 : 0]),
        (bytes) => bytes[0] ? true : false
    ),
    null: new CType("null", 1,
        () => new Uint8Array([0]),
        () => null
    )
})

/**
 * Calculate modulus of n, m
 * @param {number} n 
 * @param {number} m 
 * @returns n % m
 */

function mod(n, m) {
    return ((n % m) + m) % m;
}

/**
 * Extract the bits between two points in a buffer
 * @param {Uint8Array} buffer the buffer to extract from
 * @param {number} startPtr the nth bit to start extracting from
 * @param {number} size how many bits to extract
 * @return {Uint8Array} list of bytes extracted from the buffer
 */

function bufferExtract(buffer, startPtr, size) {
    let extract = new Uint8Array(Math.ceil(size / BYTE_LEN));
    let i = mod(BYTE_LEN - size, BYTE_LEN); // points to the next bit to be inserted into extract
    let j = startPtr; // points to the next bit to be read in "buffer"
    let endPtr = j + size;

    while(j < endPtr) {
        let di = mod(BYTE_LEN - i, BYTE_LEN) || 8; // bits to the right of "i" extract to be inserted into
        let dj = mod(BYTE_LEN - j, BYTE_LEN) || 8; // bits to the right of "j" in the buffer to be read
        let numBits = Math.min(di, dj, endPtr - j);
        let mask = ((1 << numBits) - 1) << (dj - numBits);
        let e = buffer[Math.floor(j / BYTE_LEN)] & mask;
        e = di >= dj ? e << (di - dj) : e >> (dj - di);
        extract[Math.floor(i / BYTE_LEN)] |= e;
        i += numBits;
        j += numBits;
    }

    return extract;
}

/**
 * Convert a stream of binary to an object via a struct
 * @param {Struct} struct the "schema" for the object to follow
 * @param {Uint8Array} buffer the binary stream which contains the object
 * @param {number} ptr the location of the first bit of the object in the buffer
 * @return {object} the object the binary represents
 */

function toObject(struct, buffer=new Uint8Array(0), ptr=0) {
    if(!struct) throw new Error(`Struct passed was null or undefined.`);

    let obj = {};
    let i = ptr; // pointer in the buffer to the bit the member starts

    for(let j = 0; j < struct.members.length; j++) {
        let member = struct.members[j];
        let memberName = member[0];
        let memberType = member[1];

        if(i + memberType.size >= buffer.length * BYTE_LEN) {
            throw new Error(`Could not parse struct, was outside buffer range (${buffer.length * BYTE_LEN}). Reading ${memberName} (${memberType.enum}) from bit ${i}`);
        }

        obj[memberName] = memberType.deserialize(bufferExtract(buffer, i, memberType.size));
        i += memberType.size;
    } 

    return obj;
}

/**
 * Insert a buffer into another buffer
 * @param {Uint8Array} b0 The buffer to insert
 * @param {Uint8Array} b1 The buffer to be inserted into
 * @param {number} i the ith bit position in b1 where to start inserting b0
 * @param {number} [j=0] (OPTIONAL) where to start reading b0 from
 */

function insertBuffer(b0, b1, i, j=0) {
    while(j < b0.length * BYTE_LEN) {
        let d0 = BYTE_LEN - (j % BYTE_LEN); // number of bits still to be read in b0's current byte (1-8)
        let d1 = BYTE_LEN - (i % BYTE_LEN); // number of bits still to be inserted into b1's current byte (1-8)

        let numBits = Math.min(d0, d1); // number of bits to handle this operation
        let extract = b0[Math.floor(j / BYTE_LEN)]; // get the relevant byte
        extract &= ((1 << d0) - 1) - ((1 << d0 - numBits) - 1); // apply the byte mask
        b1[Math.floor(i / BYTE_LEN)] |= (d1 - d0) >= 0 ? extract << (d1 - d0) : extract >> (d0 - d1) // insert bits into correct b1 location

        i += numBits;
        j += numBits;
    }
}

/**
 * A class which mimics C-Style arrays.
 * Can handle both primitive types (CType) and structs
 */

class PtrArray {
    /**
     * Create a new array
     * @param {number} length how many items should be stored in this array?
     * @param {CType} type the type (e.g. int, bool, or struct) to be stored in this array
     */
    constructor(length, type) {
        this.length = length;
        this.type = type;
        this.bitSize = 0;
        this.setBuffer();
    }

    /**
     * Set the buffer that the array is using 
     * @param {Uint8Array} buffer the buffer to represent this array
     * @param {boolean} pad (OPTIONAL) whether to pad / trim the array to the expected size
     */
    setBuffer(buffer, pad=true) {
        let expectedLength = Math.ceil(this.length * this.type.size / BYTE_LEN);

        let b = buffer;

        if(b != undefined) {
            if(!(b instanceof Uint8Array)) {
                throw new Error("Given buffer was not a Uint8Array")
            }
            if(pad) {
                if(b.length > expectedLength) {
                    b = b.slice(0, expectedLength);
                } else if(b.length < expectedLength) {
                    b = new Uint8Array(expectedLength);
                    b.set(buffer);
                }
            } else if (b.length < expectedLength) {
                throw new Error(`Given buffer was not of expected length. Expected length ${expectedLength}, got ${b.length}`);
            }
        }

        this.buffer = b || new Uint8Array(expectedLength);
    }

    /**
     * Get an item from the array
     * @param {number} i the ith item in the array (buffer) to get
     * @return {*} the primitive / JSON object that the binary represents
     */
    get(i) {
        if(i < 0 || !(i < this.length)) return;
        return this.type instanceof Struct ? 
            toObject(this.type, this.buffer, i * this.type.size) :
            this.type.deserialize(bufferExtract(this.buffer, i * this.type.size, this.type.size));
    }

    /**
     * Set the ith item in the array
     * @param {number} i position to set
     * @param {*} item the primitive / JSON object to place in the array
     */
    set(i, item) {
        if(i < 0 || !(i < this.length)) return;
        insertBuffer(
            this.type.serialize(item), 
            this.buffer, 
            i * this.type.size, 
            this.type.size < 8 ? mod(-this.type.size, BYTE_LEN) : 0
        );
    }

    toHex() {
        return this.buffer.reduce((hexString, byte) => hexString + byte.toString(16).padStart(2, "0"), "")
    }
}

module.exports = {cvar, CType, Struct, PtrArray}