export type Signer = {
	sign: (payload: string) => string;
	verify: (payload: string, signature: string) => boolean;
};
