export declare const config: {
    port: number;
    jwtSecret: string;
    jwtExpiresIn: string;
    uploadDir: string;
    storageType: "local" | "s3";
    s3: {
        endpoint: string;
        bucket: string;
        region: string;
        accessKey: string;
        secretKey: string;
    };
    wechat: {
        webhookUrl: string;
        enabled: boolean;
        corpId: string;
        agentId: string;
        secret: string;
    };
};
