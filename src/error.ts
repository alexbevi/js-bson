import { BSON_MAJOR_VERSION } from './constants';

/**
 * @public
 * `BSONError` objects are thrown when runtime errors occur.
 */
export class BSONError extends Error {
  /**
   * @internal
   * The underlying algorithm for isBSONError may change to improve how strict it is
   * about determining if an input is a BSONError. But it must remain backwards compatible
   * with previous minors & patches of the current major version.
   */
  protected get bsonError(): true {
    return true;
  }

  override get name(): string {
    return 'BSONError';
  }

  constructor(message: string) {
    super(message);
  }

  /**
   * @public
   *
   * All errors thrown from the BSON library inherit from `BSONError`.
   * This method can assist with determining if an error originates from the BSON library
   * even if it does not pass an `instanceof` check against this class' constructor.
   *
   * @param value - any javascript value that needs type checking
   */
  public static isBSONError(value: unknown): value is BSONError {
    return (
      value != null &&
      typeof value === 'object' &&
      'bsonError' in value &&
      value.bsonError === true &&
      // Do not access the following properties, just check existence
      'name' in value &&
      'message' in value &&
      'stack' in value
    );
  }
}

/** @public */
export class BSONVersionError extends BSONError {
  get name(): 'BSONVersionError' {
    return 'BSONVersionError';
  }

  constructor() {
    super(
      `Unsupported BSON version, bson types must be from bson ${BSON_MAJOR_VERSION}.0 or later`
    );
  }
}
