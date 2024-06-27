import { RootDatabaseOptionsWithPath, open } from 'lmdb'

const _dbOptions: RootDatabaseOptionsWithPath = {
    path: './database/AddressLookupTableDB',
    cache: { // https://github.com/kriszyp/weak-lru-cache#weaklrucacheoptions-constructor
        cacheSize: 16777216, // 16MB - maximum
        clearKeptInterval: 100,
        txnStartThreshold: 3
    },
    compression: false,
    encoding: 'msgpack',
    sharedStructuresKey: Symbol.for('Buffer'),
    eventTurnBatching: false,

    noSync: false,
    noMemInit: true,
    remapChunks: false,
    useWritemap: false,
}
const _db = open(_dbOptions)

const AddressLookupTableDB = {
    getMany: async (altAddresses: string[]): Promise<Buffer[]> => _db.getMany(altAddresses),
    put: async (altAddress: string, data: string): Promise<boolean> => _db.put(altAddress, data),
}

export default AddressLookupTableDB