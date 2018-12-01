import matchStatus, {
    TYPE_INFORMATIONAL, TYPE_SUCCESS, TYPE_REDIRECT, TYPE_CLIENT_ERROR, TYPE_SERVER_ERROR, TYPE_ABORTED,
} from "./matchStatus";
import decodeData from "./decodeData";

class Response {
    constructor(result, data, request) {
        Object.assign(this, data);
        this.status = result.status;
        this.statusText = result.statusText;
        this.headers = result.headers;
        this.request = request;
    }
}

class AbortedResponse extends Response {}
class InformationalResponse extends Response {}
class SuccessResponse extends Response {}
class RedirectResponse extends Response {}
class ClientErrorResponse extends Response {}
class ServerErrorResponse extends Response {}

const statusTypeToResponse = {
    [TYPE_ABORTED]: AbortedResponse,
    [TYPE_INFORMATIONAL]: InformationalResponse,
    [TYPE_SUCCESS]: SuccessResponse,
    [TYPE_REDIRECT]: RedirectResponse,
    [TYPE_CLIENT_ERROR]: ClientErrorResponse,
    [TYPE_SERVER_ERROR]: ServerErrorResponse,
};

const createResponse = async (result, type, request) => {
    const statusType = matchStatus(result.status);
    const ResponseClass = statusTypeToResponse[statusType];
    const data = await decodeData(result, type);
    return new ResponseClass(result, data, request);
};

export default createResponse;
export {
    Response,
    AbortedResponse,
    InformationalResponse,
    SuccessResponse,
    RedirectResponse,
    ClientErrorResponse,
    ServerErrorResponse,
};
