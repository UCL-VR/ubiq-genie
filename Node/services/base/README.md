# Base Service

A minimal example service for reference and testing. Demonstrates the service/provider pattern.

## Providers

| Provider | Backend | Requirements | Process Mode |
|----------|---------|-------------|--------------|
| `interval-printer` | Python script | None | singleton |

The interval printer outputs "Hello world!" every 5 seconds, useful for verifying the service infrastructure works.

## Programmatic Usage

```typescript
import { BaseService } from 'ubiq-genie';

const service = new BaseService(scene);
service.on('data', (data: Buffer) => {
    console.log(data.toString());
});
```
