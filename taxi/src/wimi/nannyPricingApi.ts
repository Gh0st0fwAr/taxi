import axios from 'axios'
import Config from '../config'
import { addToFormData, apiMethod, IApiMethodArguments } from '../tools/api'

export type NannyPricingQuote = {
  formula: string
  price: string | number
  options: Record<string, number>
  calculationType: string
}

type NannyPricingEnvelope = {
  status?: string
  message?: string | null
  data?: NannyPricingQuote | null
}

export { buildNannyQuotePayload } from './nannyPricingPayload'
import { buildNannyQuotePayload } from './nannyPricingPayload'

const _getNannyPricingQuote = (
  { formData }: IApiMethodArguments,
  date: string,
  startTime: string,
): Promise<NannyPricingQuote> => {
  addToFormData(formData, {
    is_var: 1,
    s_t_data: JSON.stringify(buildNannyQuotePayload(date, startTime)),
  })

  return axios.post(`${Config.API_URL}/script/template/nanny_pricing`, formData)
    .then(res => res.data as NannyPricingEnvelope)
    .then((res) => {
      if (res.status !== 'success' || !res.data || !Number.isFinite(Number(res.data.price))) {
        throw new Error(res.message || 'Сервер не вернул предварительную цену.')
      }
      return res.data
    })
}

export const getNannyPricingQuote = apiMethod<typeof _getNannyPricingQuote>(_getNannyPricingQuote)
