type RequireParamsIfDefined<Pr> = Pr extends undefined ? { params?: never } : { params: Pr } ;
type RequireBodyIfDefined<Bd> = Bd extends undefined ? { body?: never } : { body: Bd } ;
type RequireBodyTypeIfDefined<Bt> = Bt extends undefined ? { bodyType?: never } : { bodyType: Bt } ;
type RequireQueryIfDefined<Qr> = Qr extends undefined ? { query?: never } : { query: Qr } ;
type RequireHeadersIfDefined<Hd> = Hd extends undefined ? { headers?: never } : { headers: Hd } ;

type ParamsType<T> = T extends { params: infer R } ? R : undefined;
type BodyType<T> = T extends { body: infer R } ? R : undefined;
type BodyTypeType<T> = T extends { bodyType: infer R } ? R : undefined;
type QueryType<T> = T extends { query: infer R } ? R : undefined;
type HeadersType<T> = T extends { headers: infer R } ? R : undefined;

type RequestData<Pr, Bd, Bt, Qr, Hd> = RequireParamsIfDefined<Pr> &
RequireBodyIfDefined<Bd> &
RequireBodyTypeIfDefined<Bt> &
RequireQueryIfDefined<Qr> &
RequireHeadersIfDefined<Hd>;

export type {
    RequestData,
    ParamsType,
    BodyType,
    BodyTypeType,
    QueryType,
    HeadersType,
};
