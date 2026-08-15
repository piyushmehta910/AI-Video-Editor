/// <reference lib="webworker" />
import { handleWorkerMessage } from './workerProtocol'

self.onmessage = (e: MessageEvent<unknown>) => {
  const resp = handleWorkerMessage(e.data, 'decode')
  if (resp) self.postMessage(resp)
}