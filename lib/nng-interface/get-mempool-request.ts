// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';

export class GetMempoolRequest {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):GetMempoolRequest {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsGetMempoolRequest(bb:flatbuffers.ByteBuffer, obj?:GetMempoolRequest):GetMempoolRequest {
  return (obj || new GetMempoolRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsGetMempoolRequest(bb:flatbuffers.ByteBuffer, obj?:GetMempoolRequest):GetMempoolRequest {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new GetMempoolRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static startGetMempoolRequest(builder:flatbuffers.Builder) {
  builder.startObject(0);
}

static endGetMempoolRequest(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static createGetMempoolRequest(builder:flatbuffers.Builder):flatbuffers.Offset {
  GetMempoolRequest.startGetMempoolRequest(builder);
  return GetMempoolRequest.endGetMempoolRequest(builder);
}
}