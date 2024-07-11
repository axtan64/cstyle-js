<!-- ABOUT THE PROJECT -->
## About the Project

C-Style data structures, made into JavaScript. Storing data in plain JavaScript is inefficient, so I have programmed C-inspired data structures into it. cstyle-js optimises the memory used by an array by allowing a byte to contain information on multiple primitive types / structs so absolutely no memory is wasted.

<!-- GETTING STARTED -->
## Current Features

* Creation of structs using primitive types
* C-style arrays which store primitives / structs (objects) efficiently in binary. Serialization and deserialization handled.
  
<!-- USAGE -->
## Usage
### Creating an Array of Booleans

```javascript
const { cvar, PtrArray } = require('cstyle-js');

let arr = new PtrArray(8, cvar.boolean); // create array of 8 booleans

console.log(arr.toHex()); // -> 00; (only 1 byte!)
console.log(arr.get(0)); // -> false; get the first item in array

arr.set(0, true);

console.log(arr.toHex()); // -> 80 (first bit is now 1 [true])
console.log(arr.get(0)); // -> true
```

### Structs and Creating an Array of Objects

```javascript
const { cvar, Struct, PtrArray } = require('cstyle-js');

let item = new Struct("product", [
    ["itemId", cvar.int32],
    ["cost", cvar.int32],
    ["onsale", cvar.boolean]
]);

let items = new PtrArray(4, item); // create array of 4 items

items.set(1, {
    itemId: 1,
    cost: 50,
    onsale: true
});

console.log(items.get(1)); // { itemId: 1, cost: 50, onsale: true }
```

### Declaring Custom Types / Structs

cvar by default includes:
* uint4 (unsigned 4 bit integer)
* uint8 (unsigned 8 bit integer)
* int32 (signed 32 bit integer)
* bigint (signed 64 bit integer)
* char (16 bit unicode)
* boolean (1 bit true/false)
* null (1 bit null)

A new type can be created using CType with the following parameters in order:
* Name of the type
* Size of the type in bits
* How to serialize the type into an array of bytes (Uint8Array)
* How to deserialize an array of bytes into the type

The implementation for the int32 type is as follows:
```javascript
const { CType } = require('cstyle-js');

const BYTE_LEN = 8;
const BYTE_SIZE = 2 ** BYTE_LEN;

let int32 = new CType("int32", 32,
  (int) => new Uint8Array([
      (int >> (BYTE_LEN) * 3) % BYTE_SIZE,
      (int >> (BYTE_LEN) * 2) % BYTE_SIZE,
      (int >> (BYTE_LEN) * 1) % BYTE_SIZE,
      (int) % BYTE_SIZE
  ]),
  (bytes) => bytes[3] + (bytes[2] << (BYTE_LEN * 1)) + (bytes[1] << (BYTE_LEN * 2)) + (bytes[0] << (BYTE_LEN * 3))
);
```

