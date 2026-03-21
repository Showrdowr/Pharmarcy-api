declare module '@vimeo/vimeo' {
  export type VimeoRequestOptions = {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    query?: unknown;
    body?: string | Buffer;
    headers?: Record<string, string>;
  };

  export class Vimeo {
    constructor(clientId?: string, clientSecret?: string, accessToken?: string);

    request(
      options: string | VimeoRequestOptions,
      callback: (
        error: Error | null,
        body: unknown,
        statusCode: number,
        headers: Record<string, string | string[] | undefined>
      ) => void
    ): void;
  }
}
