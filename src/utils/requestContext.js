import { AsyncLocalStorage } from 'node:async_hooks';

// Holds per-request data (the request id) across every await in that request's call chain.
const requestContext = new AsyncLocalStorage();

export default requestContext;
