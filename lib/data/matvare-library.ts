// A module boundary lets Vite split the public food library while Node tests use
// the required JSON import attribute without sending it to a JavaScript chunk.
import snapshot from "./matvaretabellen.json" with { type: "json" };
export default snapshot;
