// This is evaluated on the server and inlined into client code because NEXT_PUBLIC_* env vars are compile-time public values.
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
