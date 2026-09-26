import { READER, WRITER } from "../db.ts";
import { NotFoundError, UnauthorizedError } from "../errors";
import { Invitation, User } from "../types/entities";

export const invitationIsValid = async (
  token: Invitation["token"],
): Promise<boolean> => {
  if (
    !(
      await READER`SELECT EXISTS(SELECT 1 FROM invitations WHERE token = ${token} AND uses < 3)`
    )[0].exists
  ) {
    throw new NotFoundError("Specified invitation token is invalid");
  }
  await WRITER`UPDATE invitations SET uses = uses + 1, last_used = now() WHERE token = ${token}`;
  return true;
};
export const invalidateInvitation = async (
  token: Invitation["token"],
): Promise<void> => {
  await WRITER`DELETE FROM invitations WHERE token = ${token}`;
};
export const newInvitation = async (
  creatorIdentifier: User["identifier"],
): Promise<string> => {
  const [creator] =
    await READER`SELECT * FROM users WHERE identifier = ${creatorIdentifier}`;
  if (!creator.can_create_invitations)
    throw new UnauthorizedError(
      "User is not permitted to create service invitations",
    );
  const token = crypto.randomUUID();
  const [row] =
    await WRITER`INSERT INTO invitations (token, created_by, created_at, uses) VALUES (${token}, ${creatorIdentifier}, now(), 0) RETURNING token`;
  if (!row) {
    throw new Error("Failed to insert invitation token");
  }
  return token;
};
