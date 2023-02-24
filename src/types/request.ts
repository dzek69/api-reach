type Param = `:${string}`;

interface RequestData<Pr, Bd, Qr, Hd> {
    params?: Pr;
    body?: Bd;
    query?: Qr;
    headers?: Hd;
}

export type {
    Param,
    RequestData,
};
