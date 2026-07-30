import { Request } from 'express';
import cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import { IStreamSources } from '@/types';

/**
 * Scrape stream sources asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<IStreamSources[]>} array of stream sources objects
 */
export const scrapeStreamSources = async (
    req: Request,
    res: AxiosResponse
): Promise<IStreamSources[]> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const payload: IStreamSources[] = [];
    const seen = new Set<string>();

    $('a[href*="videonode.de/iframe/"], iframe[src*="videonode.de/iframe/"]').each(
        (i, el) => {
            const link = $(el);
            const url = link.attr('href') ?? link.attr('src') ?? '';
            const provider =
                link.text().trim() ||
                url.split('/').filter(Boolean).slice(-2, -1)[0] ||
                '';

            if (!url || !provider || seen.has(url)) {
                return;
            }

            seen.add(url);

            const obj = {} as IStreamSources;

            obj['provider'] = provider;
            obj['url'] = url;
            obj['resolutions'] = [];

            payload.push(obj);
        }
    );

    return payload;
};
