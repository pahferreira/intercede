import { randomUUID } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

const cookieName = "intercede_visitor";
const oneYearInSeconds = 60 * 60 * 24 * 365;
const visitorId =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const visitorCookie = createMiddleware(async (c, next) => {
	if (!visitorId.test(getCookie(c, cookieName) ?? "")) {
		setCookie(c, cookieName, randomUUID(), {
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
			path: "/",
			maxAge: oneYearInSeconds,
		});
	}
	await next();
});
