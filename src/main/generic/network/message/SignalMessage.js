class SignalMessage extends Message {
    /**
     * @param {string} senderId
     * @param {string} recipientId
     * @param {number} nonce
     * @param {number} ttl
     * @param {SignalMessage.Flags|number} flags
     * @param {Uint8Array} [payload]
     * @param {PublicKey} [senderPubKey]
     * @param {Signature} [signature]
     */
    constructor(senderId, recipientId, nonce, ttl, flags = 0, payload = new Uint8Array(0), senderPubKey, signature) {
        super(Message.Type.SIGNAL);
        if (!senderId || !RtcPeerAddress.isSignalId(senderId)) throw 'Malformed senderId';
        if (!recipientId || !RtcPeerAddress.isSignalId(recipientId)) throw 'Malformed recipientId';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';
        if (!NumberUtils.isUint8(ttl)) throw 'Malformed ttl';
        if (!NumberUtils.isUint8(flags)) throw 'Malformed flags';
        if (!payload || !(payload instanceof Uint8Array) || !NumberUtils.isUint16(payload.byteLength)) throw 'Malformed payload';
        const hasPayload = payload.byteLength > 0;
        if (hasPayload && !(signature instanceof Signature)) throw 'Malformed signature';
        if (hasPayload && !(senderPubKey instanceof PublicKey)) throw 'Malformed public key';

        // Note that the signature is NOT verified here.
        // Callers must explicitly invoke verifySignature() to check it.

        this._senderId = senderId;
        this._recipientId = recipientId;
        this._nonce = nonce;
        this._ttl = ttl;
        this._flags = flags;
        this._payload = payload;
        this._senderPubKey = hasPayload ? senderPubKey : undefined;
        this._signature = hasPayload ? signature : undefined;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {SignalMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const senderId = buf.readString(32);
        const recipientId = buf.readString(32);
        const nonce = buf.readUint32();
        const ttl = buf.readUint8();
        const flags = buf.readUint8();
        const length = buf.readUint16();
        const payload = buf.read(length);
        const senderPubKey = length > 0 ? PublicKey.unserialize(buf) : undefined;
        const signature = length > 0 ? Signature.unserialize(buf) : undefined;
        return new SignalMessage(senderId, recipientId, nonce, ttl, flags, payload, senderPubKey, signature);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeString(this._senderId, 32);
        buf.writeString(this._recipientId, 32);
        buf.writeUint32(this._nonce);
        buf.writeUint8(this._ttl);
        buf.writeUint8(this._flags);
        buf.writeUint16(this._payload.byteLength);
        buf.write(this._payload);
        if (this._payload.byteLength > 0) {
            this._senderPubKey.serialize(buf);
            this._signature.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*senderId*/ 32
            + /*recipientId*/ 32
            + /*nonce*/ 4
            + /*ttl*/ 1
            + /*flags*/ 1
            + /*payloadLength*/ 2
            + this._payload.byteLength
            + (this._payload.byteLength > 0 ? this._senderPubKey.serializedSize : 0)
            + (this._payload.byteLength > 0 ? this._signature.serializedSize : 0);
    }

    /**
     * @return {Promise.<boolean>}
     */
    async verifySignature() {
        if (!this._signature) {
            return false;
        }
        return this._signature.verify(this._senderPubKey, this._payload) && BufferUtils.equals(await this._senderPubKey.toSignalId(), BufferUtils.fromHex(this._senderId));
    }

    /** @type {string} */
    get senderId() {
        return this._senderId;
    }

    /** @type {string} */
    get recipientId() {
        return this._recipientId;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    /** @type {number} */
    get ttl() {
        return this._ttl;
    }

    /** @type {SignalMessage.Flags|number} */
    get flags() {
        return this._flags;
    }

    /** @type {Uint8Array} */
    get payload() {
        return this._payload;
    }

    /** @type {Signature} */
    get signature() {
        return this._signature;
    }

    /** @type {PublicKey} */
    get senderPubKey() {
        return this._senderPubKey;
    }

    /**
     * @returns {boolean}
     */
    hasPayload() {
        return this._payload.byteLength > 0;
    }

    /**
     * @returns {boolean}
     */
    isUnroutable() {
        return (this._flags & SignalMessage.Flags.UNROUTABLE) !== 0;
    }

    /**
     * @returns {boolean}
     */
    isTtlExceeded() {
        return (this._flags & SignalMessage.Flags.TTL_EXCEEDED) !== 0;
    }
}
/**
 * @enum {number}
 */
SignalMessage.Flags = {
    UNROUTABLE: 0x1,
    TTL_EXCEEDED: 0x2
};
Class.register(SignalMessage);
