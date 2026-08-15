/// <reference lib="webworker" />
import { handleWorkerMessage } from './workerProtocol'

self.onmessage = (e: MessageEvent<unknown>) => {
  const resp = handleWorkerMessage(e.data, 'encode')
  if (resp) self.postMessage(resp)
}