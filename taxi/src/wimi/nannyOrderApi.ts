import axios from 'axios'
import Config from '../config'
import { addToFormData, apiMethod, IApiMethodArguments } from '../tools/api'
import {
  buildNannyCreatePayload,
  NannyCreateOrderEnvelope,
  NannyCreateOrderResult,
  parseNannyCreateOrderEnvelope,
  WimiCreateOrderDraft,
} from './nannyOrderPayload'

export { buildNannyCreatePayload, parseNannyCreateOrderEnvelope } from './nannyOrderPayload'
export type { NannyCreateOrderResult, WimiCreateOrderDraft } from './nannyOrderPayload'

/**
 * Real order creation stays disabled unless an explicit release build enables it.
 * This is a release guard, not a substitute for backend authorization/validation.
 */
export const isWimiRealOrderCreationEnabled = (): boolean =>
  process.env.REACT_APP_WIMI_ENABLE_REAL_CREATE === 'true'

const _createNannyOrder = (
  { formData }: IApiMethodArguments,
  draft: WimiCreateOrderDraft,
  requestKey: string,
): Promise<NannyCreateOrderResult> => {
  if (!isWimiRealOrderCreationEnabled()) {
    return Promise.reject(new Error('Реальное создание заказов WIMI отключено до завершения серверных проверок.'))
  }

  addToFormData(formData, {
    is_var: 1,
    s_t_data: JSON.stringify(buildNannyCreatePayload(draft, requestKey)),
  })

  return axios.post(`${Config.API_URL}/script/template/nanny_pricing`, formData)
    .then(response => parseNannyCreateOrderEnvelope(response.data as NannyCreateOrderEnvelope))
}

/** Uses the authenticated WIMI user session; no administrator credentials are exposed. */
export const createNannyOrder = apiMethod<typeof _createNannyOrder>(_createNannyOrder)
