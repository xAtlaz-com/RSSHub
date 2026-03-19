import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import { config } from '@/config';

interface SlackAttachment {
    text?: string;
    title?: string;
    image_url?: string;
}

interface SlackFile {
    url_private?: string;
    name?: string;
    mimetype?: string;
}

interface SlackMessage {
    type: string;
    text?: string;
    user?: string;
    ts: string;
    attachments?: SlackAttachment[];
    files?: SlackFile[];
    bot_id?: string;
    subtype?: string;
}

export const route: Route = {
    path: '/channel/:workspace/:channelId',
    categories: ['social-media'],
    example: '/slack/channel/workspace1/C08QNQBTBCK',
    parameters: {
        workspace: '工作区标识符，用于区分不同的 Slack 工作区',
        channelId: 'Slack 频道 ID（以 C 开头的字符串，可在频道详情中找到）',
    },
    features: {
        requireConfig: [
            {
                name: 'SLACK_TOKEN_workspace',
                description: 'Slack Token（以 xoxc- 开头），从浏览器开发者工具复制请求中的 token 参数',
            },
        ],
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Slack 频道消息',
    maintainers: [],
    handler,
    description: `
:::tip
此路由使用 Slack Web API 获取频道消息。

**配置方法：**

1. 登录 Slack 网页版
2. F12 打开开发者工具 → Network
3. 点击任意频道，找到 conversations.history 请求
4. 查看请求参数，复制 token 的值（以 xoxc- 开头）
5. （可选）复制请求的 Cookie
6. 设置环境变量：

SLACK_TOKEN_company="xoxc-xxx"
SLACK_COOKIE_company="复制的cookie"

**URL 格式：**
/slack/channel/{workspace}/{channelId}

**示例：**
/slack/channel/company/C08QNQBTBCK
:::
    `,
};

async function handler(ctx) {
    const { workspace, channelId } = ctx.req.param();
    
    const token = process.env[`SLACK_TOKEN_${workspace}`];
    const cookie = process.env[`SLACK_COOKIE_${workspace}`];

    if (!token) {
        throw new Error(`SLACK_TOKEN_${workspace} is required. Please set the token in environment variables.`);
    }

    const messages = await cache.tryGet(
        `slack:channel:${workspace}:${channelId}`,
        async () => {
            const formData = new FormData();
            formData.append('token', token);
            formData.append('channel', channelId);

            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                'Referer': 'https://app.slack.com/',
            };
            
            if (cookie) {
                headers.Cookie = cookie;
            }

            const response = await fetch('https://llm-d.slack.com/api/conversations.history', {
                method: 'POST',
                headers,
                body: formData,
            });

            const data = await response.json();

            if (!data.ok) {
                throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
            }

            return data.messages?.filter((msg: SlackMessage) => msg.type === 'message' && msg.text) || [];
        },
        config.cache.routeExpire,
        false
    );

    const items: DataItem[] = messages.map((msg: SlackMessage) => {
        let description = msg.text || '';

        if (msg.attachments && msg.attachments.length > 0) {
            for (const attachment of msg.attachments) {
                if (attachment.title) {
                    description += `<h3>${attachment.title}</h3>`;
                }
                if (attachment.text) {
                    description += `<p>${attachment.text}</p>`;
                }
                if (attachment.image_url) {
                    description += `<img src="${attachment.image_url}" />`;
                }
            }
        }

        if (msg.files && msg.files.length > 0) {
            description += '<p>附件：</p><ul>';
            for (const file of msg.files) {
                description += `<li><a href="${file.url_private}">${file.name}</a></li>`;
            }
            description += '</ul>';
        }

        const author = msg.user || msg.bot_id || 'Unknown';

        return {
            title: msg.text?.slice(0, 100) || '(无标题)',
            description,
            link: `https://app.slack.com/client/T${channelId}/${channelId}`,
            author,
            pubDate: parseDate(Number.parseFloat(msg.ts) * 1000),
            guid: `slack:${workspace}:${channelId}:${msg.ts}`,
        };
    });

    return {
        title: `Slack - ${channelId}`,
        link: `https://app.slack.com/client/T${channelId}/${channelId}`,
        description: `Slack 频道 ${channelId} 的消息订阅`,
        item: items,
    };
}
