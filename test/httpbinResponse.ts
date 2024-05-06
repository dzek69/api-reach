type HTTPBinAnythingResponse = {
    args: Record<string, string>;
    data: string;
    files: Record<string, unknown>;
    form: Record<string, unknown>;
    headers: Record<string, string>;
    json: null;
    method: string;
    url: string;
    origin: string;

};

export type {
    HTTPBinAnythingResponse,
};
