// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { GetBlockRangeRequest } from '../nng-interface/get-block-range-request.js';
import { GetBlockRequest } from '../nng-interface/get-block-request.js';
import { GetBlockSliceRequest } from '../nng-interface/get-block-slice-request.js';
import { GetMempoolRequest } from '../nng-interface/get-mempool-request.js';
import { GetUndoSliceRequest } from '../nng-interface/get-undo-slice-request.js';


export enum RpcRequest {
  NONE = 0,
  GetBlockRequest = 1,
  GetBlockRangeRequest = 2,
  GetBlockSliceRequest = 3,
  GetUndoSliceRequest = 4,
  GetMempoolRequest = 5
}

export function unionToRpcRequest(
  type: RpcRequest,
  accessor: (obj:GetBlockRangeRequest|GetBlockRequest|GetBlockSliceRequest|GetMempoolRequest|GetUndoSliceRequest) => GetBlockRangeRequest|GetBlockRequest|GetBlockSliceRequest|GetMempoolRequest|GetUndoSliceRequest|null
): GetBlockRangeRequest|GetBlockRequest|GetBlockSliceRequest|GetMempoolRequest|GetUndoSliceRequest|null {
  switch(RpcRequest[type]) {
    case 'NONE': return null; 
    case 'GetBlockRequest': return accessor(new GetBlockRequest())! as GetBlockRequest;
    case 'GetBlockRangeRequest': return accessor(new GetBlockRangeRequest())! as GetBlockRangeRequest;
    case 'GetBlockSliceRequest': return accessor(new GetBlockSliceRequest())! as GetBlockSliceRequest;
    case 'GetUndoSliceRequest': return accessor(new GetUndoSliceRequest())! as GetUndoSliceRequest;
    case 'GetMempoolRequest': return accessor(new GetMempoolRequest())! as GetMempoolRequest;
    default: return null;
  }
}

export function unionListToRpcRequest(
  type: RpcRequest, 
  accessor: (index: number, obj:GetBlockRangeRequest|GetBlockRequest|GetBlockSliceRequest|GetMempoolRequest|GetUndoSliceRequest) => GetBlockRangeRequest|GetBlockRequest|GetBlockSliceRequest|GetMempoolRequest|GetUndoSliceRequest|null, 
  index: number
): GetBlockRangeRequest|GetBlockRequest|GetBlockSliceRequest|GetMempoolRequest|GetUndoSliceRequest|null {
  switch(RpcRequest[type]) {
    case 'NONE': return null; 
    case 'GetBlockRequest': return accessor(index, new GetBlockRequest())! as GetBlockRequest;
    case 'GetBlockRangeRequest': return accessor(index, new GetBlockRangeRequest())! as GetBlockRangeRequest;
    case 'GetBlockSliceRequest': return accessor(index, new GetBlockSliceRequest())! as GetBlockSliceRequest;
    case 'GetUndoSliceRequest': return accessor(index, new GetUndoSliceRequest())! as GetUndoSliceRequest;
    case 'GetMempoolRequest': return accessor(index, new GetMempoolRequest())! as GetMempoolRequest;
    default: return null;
  }
}