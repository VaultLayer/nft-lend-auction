// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  TypedMap,
  Entity,
  Value,
  ValueKind,
  store,
  Bytes,
  BigInt,
  BigDecimal,
} from "@graphprotocol/graph-ts";

export class Loan extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id != null, "Cannot save Loan entity without an ID");
    if (id) {
      assert(
        id.kind == ValueKind.STRING,
        `Entities of type Loan must have an ID of type String but the id '${id.displayData()}' is of type ${id.displayKind()}`,
      );
      store.set("Loan", id.toString(), this);
    }
  }

  static loadInBlock(id: string): Loan | null {
    return changetype<Loan | null>(store.get_in_block("Loan", id));
  }

  static load(id: string): Loan | null {
    return changetype<Loan | null>(store.get("Loan", id));
  }

  get id(): string {
    let value = this.get("id");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toString();
    }
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get borrower(): string {
    let value = this.get("borrower");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toString();
    }
  }

  set borrower(value: string) {
    this.set("borrower", Value.fromString(value));
  }

  get lender(): string | null {
    let value = this.get("lender");
    if (!value || value.kind == ValueKind.NULL) {
      return null;
    } else {
      return value.toString();
    }
  }

  set lender(value: string | null) {
    if (!value) {
      this.unset("lender");
    } else {
      this.set("lender", Value.fromString(<string>value));
    }
  }

  get nftAddress(): Bytes {
    let value = this.get("nftAddress");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBytes();
    }
  }

  set nftAddress(value: Bytes) {
    this.set("nftAddress", Value.fromBytes(value));
  }

  get tokenId(): BigInt {
    let value = this.get("tokenId");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBigInt();
    }
  }

  set tokenId(value: BigInt) {
    this.set("tokenId", Value.fromBigInt(value));
  }

  get loanAmount(): BigDecimal {
    let value = this.get("loanAmount");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBigDecimal();
    }
  }

  set loanAmount(value: BigDecimal) {
    this.set("loanAmount", Value.fromBigDecimal(value));
  }

  get maxInterestRate(): BigDecimal {
    let value = this.get("maxInterestRate");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBigDecimal();
    }
  }

  set maxInterestRate(value: BigDecimal) {
    this.set("maxInterestRate", Value.fromBigDecimal(value));
  }

  get currentInterestRate(): BigDecimal {
    let value = this.get("currentInterestRate");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBigDecimal();
    }
  }

  set currentInterestRate(value: BigDecimal) {
    this.set("currentInterestRate", Value.fromBigDecimal(value));
  }

  get duration(): BigInt {
    let value = this.get("duration");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBigInt();
    }
  }

  set duration(value: BigInt) {
    this.set("duration", Value.fromBigInt(value));
  }

  get startTime(): BigInt | null {
    let value = this.get("startTime");
    if (!value || value.kind == ValueKind.NULL) {
      return null;
    } else {
      return value.toBigInt();
    }
  }

  set startTime(value: BigInt | null) {
    if (!value) {
      this.unset("startTime");
    } else {
      this.set("startTime", Value.fromBigInt(<BigInt>value));
    }
  }

  get isAccepted(): boolean {
    let value = this.get("isAccepted");
    if (!value || value.kind == ValueKind.NULL) {
      return false;
    } else {
      return value.toBoolean();
    }
  }

  set isAccepted(value: boolean) {
    this.set("isAccepted", Value.fromBoolean(value));
  }

  get status(): string {
    let value = this.get("status");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toString();
    }
  }

  set status(value: string) {
    this.set("status", Value.fromString(value));
  }

  get loanType(): string {
    let value = this.get("loanType");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toString();
    }
  }

  set loanType(value: string) {
    this.set("loanType", Value.fromString(value));
  }
}

export class User extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id != null, "Cannot save User entity without an ID");
    if (id) {
      assert(
        id.kind == ValueKind.STRING,
        `Entities of type User must have an ID of type String but the id '${id.displayData()}' is of type ${id.displayKind()}`,
      );
      store.set("User", id.toString(), this);
    }
  }

  static loadInBlock(id: string): User | null {
    return changetype<User | null>(store.get_in_block("User", id));
  }

  static load(id: string): User | null {
    return changetype<User | null>(store.get("User", id));
  }

  get id(): string {
    let value = this.get("id");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toString();
    }
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get loansBorrowed(): LoanLoader {
    return new LoanLoader("User", this.get("id")!.toString(), "loansBorrowed");
  }

  get loansLended(): LoanLoader {
    return new LoanLoader("User", this.get("id")!.toString(), "loansLended");
  }

  get totalWithdrawn(): BigDecimal {
    let value = this.get("totalWithdrawn");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBigDecimal();
    }
  }

  set totalWithdrawn(value: BigDecimal) {
    this.set("totalWithdrawn", Value.fromBigDecimal(value));
  }

  get pendingWithdraw(): BigDecimal {
    let value = this.get("pendingWithdraw");
    if (!value || value.kind == ValueKind.NULL) {
      throw new Error("Cannot return null for a required field.");
    } else {
      return value.toBigDecimal();
    }
  }

  set pendingWithdraw(value: BigDecimal) {
    this.set("pendingWithdraw", Value.fromBigDecimal(value));
  }
}

export class LoanLoader extends Entity {
  _entity: string;
  _field: string;
  _id: string;

  constructor(entity: string, id: string, field: string) {
    super();
    this._entity = entity;
    this._id = id;
    this._field = field;
  }

  load(): Loan[] {
    let value = store.loadRelated(this._entity, this._id, this._field);
    return changetype<Loan[]>(value);
  }
}
