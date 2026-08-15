/// <reference lib="webworker" />
import { handleWorkerMessage } from './workerProtocol'

self.onmessage = (e: MessageEvent<unknown>) => {
  const resp = handleWorkerMessage(e.data, 'render')
  if (resp) self.postMessage(resp)
}