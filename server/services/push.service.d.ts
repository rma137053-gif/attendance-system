interface PushMessage {
    userId: string;
    title: string;
    body: string;
    type: 'CLOCK_IN_REMINDER' | 'CLOCK_IN_URGE' | 'CLOCK_OUT_REMINDER';
    rosterId?: string;
}
export declare function sendPush(msg: PushMessage): Promise<{
    success: boolean;
    error?: string;
}>;
export {};
