import { randomUUID } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

const cookieName = "intercede_visitor";
const oneYearInSeconds = 60 * 60 * 24 * 365;
const visitorIdPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type VisitorEnv = { Variables: { visitorId: string } };

export const visitorCookie = createMiddleware<VisitorEnv>(async (c, next) => {
	const existing = getCookie(c, cookieName) ?? "";
	if (visitorIdPattern.test(existing)) {
		c.set("visitorId", existing);
	} else {
		const visitorId = randomUUID();
		setCookie(c, cookieName, visitorId, {
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
			path: "/",
			maxAge: oneYearInSeconds,
		});
		c.set("visitorId", visitorId);
	}
	await next();
});
