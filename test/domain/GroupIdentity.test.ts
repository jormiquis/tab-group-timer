import { describe, expect, it } from "vitest";
import {
  NO_GROUP_KEY,
  UNTITLED_GROUP_KEY,
  groupIdentityOf,
} from "../../src/domain/GroupIdentity";

describe("groupIdentityOf", () => {
  it("treats titles differing only in case or padding as the same task", () => {
    expect(groupIdentityOf(1, "Client A").groupKey).toBe(groupIdentityOf(9, "  client a ").groupKey);
  });

  it("keeps the title as typed for display", () => {
    expect(groupIdentityOf(1, "  Client A ").groupTitle).toBe("Client A");
  });

  it("buckets ungrouped tabs separately from untitled groups", () => {
    expect(groupIdentityOf(null).groupKey).toBe(NO_GROUP_KEY);
    expect(groupIdentityOf(7, "").groupKey).toBe(UNTITLED_GROUP_KEY);
  });

  it("does not let recycled group ids collide across different titles", () => {
    // Chrome reuses ids across sessions; identity must come from the title.
    expect(groupIdentityOf(3, "Invoicing").groupKey).not.toBe(groupIdentityOf(3, "Research").groupKey);
  });
});
