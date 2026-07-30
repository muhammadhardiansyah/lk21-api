import cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISetOfYears } from '@/types';

/**
 * Scrape a set of release years asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<ISetOfYears[]>} a set of release years
 */
export const scrapeSetOfYears = async (
    req: Request,
    res: AxiosResponse
): Promise<ISetOfYears[]> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const payload: ISetOfYears[] = [];
    const {
        protocol,
        headers: { host },
    } = req;

    const seen = new Set<string>();

    $('select[name="tahun"] option').each((i, el) => {
        const parameter = $(el).attr('value')?.trim() ?? '';

        if (!parameter || parameter === '0' || seen.has(parameter)) {
            return;
        }

        seen.add(parameter);

        const obj = {} as ISetOfYears;

        obj['parameter'] = parameter;
        obj['numberOfContents'] = 0;
        obj['url'] = `${protocol}://${host}/years/${parameter}`;

        payload.push(obj);
    });

    return payload;
};
