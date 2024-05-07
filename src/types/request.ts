interface RequestData<Pr, Bd, Bt, Qr, Hd> {
    params?: Pr;
    body?: Bd;
    bodyType?: Bt;
    query?: Qr;
    headers?: Hd;
}

export type {
    RequestData,
};
