import cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISetOfCountries } from '@/types';
import countries from '@/json/countries.json';

/**
 * Scrape a set of countries asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<ISetOfCountries[]>} a set of countries
 */
export const scrapeSetOfCountries = async (
    req: Request,
    res: AxiosResponse
) => {
    const $: cheerio.Root = cheerio.load(res.data);
    const payload: ISetOfCountries[] = [];
    const {
        protocol,
        headers: { host },
    } = req;

    const seen = new Set<string>();

    $('select[name="country"] option').each((i, el) => {
        const parameter = $(el).attr('value')?.trim() ?? '';
        const name = $(el).text().trim();

        if (!parameter || !name || name.startsWith('-') || seen.has(parameter)) {
            return;
        }

        seen.add(parameter);

        const country = countries.find((item) => item.parameter === parameter);

        const obj = {} as ISetOfCountries;

        obj['parameter'] = parameter;
        obj['name'] = country?.name ?? name;
        obj['numberOfContents'] = 0;
        obj['url'] = `${protocol}://${host}/countries/${parameter}`;

        payload.push(obj);
    });

    return payload;
};
