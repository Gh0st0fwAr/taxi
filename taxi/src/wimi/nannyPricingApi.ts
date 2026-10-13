import axios from 'axios'
import Config from '../config'
import { addToFormData, apiMethod, IApiMethodArguments } from '../tools/api'
import { buildNannyQuotePayload } from './nannyPricingPayload'
import { NannyPricingEnvelope, NannyPricingQuote, parseNannyPricingEnvelope } from './nannyPricingEnvelope'

export { parseNannyPricingEnvelope } from './nannyPricingEnvelope'

export { buildNannyQuotePayload } from './nannyPricingPayload'

const _getNannyPricingQuote = (
  { formData }: IApiMethodArguments,
  date: string,
  startTime: string,
  durationMinutes: number,
): Promise<NannyPricingQuote> => {
  addToFormData(formData, {
    is_var: 1,
    s_t_data: JSON.stringify(buildNannyQuotePayload(date, startTime, durationMinutes)),
  })

  return axios.post(`${Config.API_URL}/script/template/nanny_pricing`, formData)
    .then(res => res.data as NannyPricingEnvelope)
    .then(parseNannyPricingEnvelope)
}

export const getNannyPricingQuote = apiMethod<typeof _getNannyPricingQuote>(_getNannyPricingQuote)
