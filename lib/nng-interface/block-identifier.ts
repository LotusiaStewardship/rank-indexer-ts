// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { BlockHash } from '../nng-interface/block-hash.js';
import { BlockHeight } from '../nng-interface/block-height.js';


export enum BlockIdentifier {
  NONE = 0,
  Height = 1,
  Hash = 2
}

export function unionToBlockIdentifier(
  type: BlockIdentifier,
  accessor: (obj:BlockHash|BlockHeight) => BlockHash|BlockHeight|null
): BlockHash|BlockHeight|null {
  switch(BlockIdentifier[type]) {
    case 'NONE': return null; 
    case 'Height': return accessor(new BlockHeight())! as BlockHeight;
    case 'Hash': return accessor(new BlockHash())! as BlockHash;
    default: return null;
  }
}

export function unionListToBlockIdentifier(
  type: BlockIdentifier, 
  accessor: (index: number, obj:BlockHash|BlockHeight) => BlockHash|BlockHeight|null, 
  index: number
): BlockHash|BlockHeight|null {
  switch(BlockIdentifier[type]) {
    case 'NONE': return null; 
    case 'Height': return accessor(index, new BlockHeight())! as BlockHeight;
    case 'Hash': return accessor(index, new BlockHash())! as BlockHash;
    default: return null;
  }
}