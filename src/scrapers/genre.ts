import cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISetOfGenres } from '@/types';

/**
 * Scrape a set of genres asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<ISetOfGenres[]>} a set of genres
 */
export const scrapeSetOfGenres = async (
    req: Request,
    res: AxiosResponse
): Promise<ISetOfGenres[]> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const payload: ISetOfGenres[] = [];
    const {
        headers: { host },
        protocol,
    } = req;

    const seen = new Set<string>();

    $('select[name^="genre"] option').each((i, el) => {
        const parameter = $(el).attr('value')?.trim() ?? '';
        const name = $(el).text().trim();

        if (!parameter || !name || name.startsWith('-') || seen.has(parameter)) {
            return;
        }

        seen.add(parameter);

        const obj = {} as ISetOfGenres;

        obj['parameter'] = parameter;
        obj['name'] = name;
        obj['numberOfContents'] = 0;
        obj['url'] = `${protocol}://${host}/genres/${parameter}`;

        payload.push(obj);
        });

    return payload;
};
