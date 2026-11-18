import { randomUUID } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

const cookieName = "intercede_visitor";
const oneYearInSeconds = 60 * 60 * 24 * 365;
const visitorId =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type VisitorEnv = { Variables: { visitorId: string } };

export const visitorCookie = createMiddleware<VisitorEnv>(async (c, next) => {
	const returning = getCookie(c, cookieName) ?? "";
	if (visitorId.test(returning)) {
		c.set("visitorId", returning);
	} else {
		const issued = randomUUID();
		c.set("visitorId", issued);
		setCookie(c, cookieName, issued, {
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
			path: "/",
			maxAge: oneYearInSeconds,
		});
	}
	await next();
});
