declare module '@garmin/fitsdk' {
  export class Stream {
    static fromArrayBuffer(buffer: ArrayBuffer): Stream;
    static fromByteArray(bytes: number[]): Stream;
  }

  export class Decoder {
    constructor(stream: Stream);
    isFIT(): boolean;
    checkIntegrity(): boolean;
    read(options?: {
      mesgListener?: (mesgNum: number, mesg: Record<string, unknown>) => void;
      fieldDescriptionListener?: (
        key: number,
        developerDataIdMesg: Record<string, unknown>,
        fieldDescriptionMesg: Record<string, unknown>,
      ) => void;
      applyScaleAndOffset?: boolean;
      expandSubFields?: boolean;
      expandComponents?: boolean;
      convertTypesToStrings?: boolean;
      convertDateTimesToDates?: boolean;
      includeUnknownData?: boolean;
      mergeHeartRates?: boolean;
      decodeMemoGlobs?: boolean;
    }): {
      messages: Record<string, unknown[]>;
      profileVersion?: number;
      errors: Error[];
    };
  }

  export class Encoder {
    constructor(options?: {
      fieldDescriptions?: Record<number, {
        developerDataIdMesg: Record<string, unknown>;
        fieldDescriptionMesg: Record<string, unknown>;
      }>;
    });
    onMesg(mesgNum: number, mesg: Record<string, unknown>): this;
    addDeveloperField(
      key: number,
      developerDataIdMesg: Record<string, unknown>,
      fieldDescriptionMesg: Record<string, unknown>,
    ): this;
    close(): Uint8Array;
  }
}