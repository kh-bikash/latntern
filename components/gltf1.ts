// Converts legacy b3dm tiles that embed binary glTF 1.0 (KHR_binary_glTF, CESIUM_RTC) into glTF 2.0 b3dm.
export function isGltf1B3dm(buffer:ArrayBuffer){const v=new DataView(buffer);if(v.byteLength<40)return false;const off=28+v.getUint32(12,true)+v.getUint32(16,true)+v.getUint32(20,true)+v.getUint32(24,true);return v.getUint32(off,true)===0x46546c67&&v.getUint32(off+4,true)===1;}
export function convertGltf1B3dm(buffer:ArrayBuffer):ArrayBuffer{void buffer;throw new Error('glTF 1.0 conversion not implemented yet');}
