
import AsyncStorage from '@react-native-async-storage/async-storage';
import { _http_request, } from '../../funcs/functions';
import { namer, __CONFIG__ } from '../static';
import DeviceInfo from 'react-native-device-info';
import { Dimensions } from 'react-native';
import { xxa_logggingReport } from './logging';

export class cacheStorage {
    // Profile
    private static profileMemoryCache: any = null;
    private static profileLoadingPromise: Promise<any> | null = null;
    public static getCurrentUserProfile = (forceRefresh = false): Promise<any> => {
        // Return from memory cache if available and not forcing refresh
        if (!forceRefresh && this.profileMemoryCache) {
            //console.log("profile from cache");
            return Promise.resolve(this.profileMemoryCache);
        }

        // Prevent duplicate concurrent requests
        if (!forceRefresh && this.profileLoadingPromise) {
            //console.log("profile request in progress, waiting...");
            return this.profileLoadingPromise;
        }

        // Start new request
        this.profileLoadingPromise = (async () => {
            try {
                // Check AsyncStorage cache if not forcing refresh
                if (!forceRefresh) {
                    try {
                        const cachedProfile = await AsyncStorage.getItem(namer.storage.currentUserProfile);
                        if (cachedProfile) {
                            //console.log("profile from AsyncStorage");
                            this.profileMemoryCache = JSON.parse(cachedProfile);
                            return this.profileMemoryCache;
                        }
                    } catch (error) {
                        console.error("Error reading profile from AsyncStorage:", error);
                    }
                }

                // Fetch fresh data from API
                //console.log("fetching profile from API");
                const profile = await _http_request({
                    customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getProfile',
                    reqType: 'POST',
                });

                // A null/false response means the request itself failed (offline, timeout, server error) --
                // keep whatever profile we already have rather than wiping it out on a transient blip.
                if (profile === null || profile === false || profile === undefined) {
                    console.log("Profile refresh failed, keeping existing cache");
                    if (!this.profileMemoryCache) {
                        try {
                            const cachedProfile = await AsyncStorage.getItem(namer.storage.currentUserProfile);
                            if (cachedProfile) {
                                this.profileMemoryCache = JSON.parse(cachedProfile);
                            }
                        } catch (error) {
                            console.error("Error reading fallback profile from AsyncStorage:", error);
                        }
                    }
                    return this.profileMemoryCache;
                }

                if (profile?.currentUser !== undefined && profile?.currentUser !== null && profile?.currentUser !== "") {
                    // Cache in memory and AsyncStorage
                    this.profileMemoryCache = profile?.currentUser;
                    await AsyncStorage.setItem(namer.storage.currentUserProfile, JSON.stringify(profile?.currentUser));
                } else {
                    this.profileMemoryCache = null;
                    await AsyncStorage.removeItem(namer.storage.currentUserProfile);
                    console.log("Profile removed. no valid data")
                }
                return this.profileMemoryCache;
            } catch (error) {
                console.error("Error fetching profile:", error);
                this.profileLoadingPromise = null;
                throw error;
            }
        })();

        return this.profileLoadingPromise;
    }



    // Device specs cache
    private static deviceMemoryCache: any = null;
    private static deviceLoadingPromise: Promise<any> | null = null;
    public static getDeviceData = (forceRefresh = false): Promise<any> => {
        // memory cache
        if (!forceRefresh && this.deviceMemoryCache) {
            //console.log("device info from cache");
            return this.deviceMemoryCache;
        }

        // prevent duplicate calls
        if (!forceRefresh && this.deviceLoadingPromise) {
            return this.deviceLoadingPromise;
        }

        this.deviceLoadingPromise = (async () => {
            // storage cache
            if (!forceRefresh) {
                const getFromLocalStorage = await AsyncStorage.getItem(namer.storage.deviceSpecs);
                if (getFromLocalStorage) {
                    //console.log("device info from LocalStorage");
                    this.deviceMemoryCache = JSON.parse(getFromLocalStorage);
                    return this.deviceMemoryCache;
                }
            }

            // sync base
            const base = {
                Id: DeviceInfo.getDeviceId(),
                Type: DeviceInfo.getDeviceType(),
                Model: DeviceInfo.getModel(),
                Brand: DeviceInfo.getBrand(),
                ScreenDimension: Dimensions.get('screen'),
                Os: `${DeviceInfo.getSystemName()}_${DeviceInfo.getSystemVersion()}`
            };

            // async batch
            const results = await Promise.allSettled([
                DeviceInfo.getDeviceName(),
                DeviceInfo.getDevice(),
                DeviceInfo.isEmulator(),
                DeviceInfo.getManufacturer(),
                DeviceInfo.getSerialNumber(),
                DeviceInfo.getBootloader(),
                DeviceInfo.getFingerprint(),
                DeviceInfo.getUserAgent(),
                DeviceInfo.getBaseOs(),
                DeviceInfo.getBatteryLevel(),
                DeviceInfo.getCarrier(),
                DeviceInfo.getCodename(),
                DeviceInfo.getDeviceToken(),
                DeviceInfo.isPinOrFingerprintSet(),
                DeviceInfo.isMouseConnected(),
                DeviceInfo.getUniqueId(),
            ]);

            const values = results.map(r =>
                r.status === 'fulfilled' ? r.value : null
            );

            const [
                Name, Device, isEmulator, Manufacturer, SerialNumber,
                Bootloader, Fingerprint, UserAgent, BaseOs, BatteryLevel,
                Carrier, Codename, Token, isPinOrFingerprintSet, isMouseConnected,
                InstallationId
            ] = values;

            const full = {
                ...base,
                Name,
                Device,
                isEmulator,
                Manufacturer,
                SerialNumber,
                Bootloader,
                Fingerprint,
                UserAgent,
                BaseOs,
                BatteryLevel,
                Carrier,
                Codename,
                Token,
                isPinOrFingerprintSet,
                isMouseConnected,
                InstallationId
            };

            this.deviceMemoryCache = full;
            await AsyncStorage.setItem(namer.storage.deviceSpecs, JSON.stringify(full));

            return full;
        })();

        return this.deviceLoadingPromise;
    }



    // Device
    // Products
    private static productsMemoryCache: any = null;
    private static productsLoadingPromise: Promise<any> | null = null;
    public static getProducts = (forceRefresh = false): Promise<any> => {
        // Return from memory cache if available and not forcing refresh
        if (!forceRefresh && this.productsMemoryCache) {
            //console.log("getProducts info from cache");
            return Promise.resolve(this.productsMemoryCache);
        }

        // Prevent duplicate concurrent requests
        if (!forceRefresh && this.productsLoadingPromise) {
            //console.log("productsLoadingPromise request in progress, waiting...");
            return this.productsLoadingPromise;
        }

        // Start new request
        this.productsLoadingPromise = (async () => {
            try {
                // Check AsyncStorage cache if not forcing refresh
                if (!forceRefresh) {
                    try {
                        const cachedProducts = await AsyncStorage.getItem(namer.storage.products);
                        if (cachedProducts) {
                            //console.log("getProducts from AsyncStorage");
                            this.productsMemoryCache = JSON.parse(cachedProducts);
                            return this.productsMemoryCache;
                        }
                    } catch (error) {
                        console.error("Error reading getProducts from AsyncStorage:", error);
                    }
                }

                // Fetch fresh data from API
                //console.log("fetching getProducts from API");
                const response = await _http_request({
                    customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getProducts',
                    reqType: 'POST',
                });

                //console.log("API response:", response);

                // A null/false response means the request itself failed (offline, timeout, server error) --
                // keep whatever products we already have rather than wiping it out on a transient blip.
                if (response === null || response === false || response === undefined) {
                    console.log("getProducts refresh failed, keeping existing cache");
                    if (!this.productsMemoryCache) {
                        try {
                            const cachedProducts = await AsyncStorage.getItem(namer.storage.products);
                            if (cachedProducts) {
                                this.productsMemoryCache = JSON.parse(cachedProducts);
                            }
                        } catch (error) {
                            console.error("Error reading fallback products from AsyncStorage:", error);
                        }
                    }
                    return this.productsMemoryCache;
                }

                // Extract products from response
                const productsData = response?.products;

                if (productsData !== undefined && productsData !== null && productsData !== "") {
                    // Cache in memory and AsyncStorage
                    //console.log("getProducts added successfully");
                    this.productsMemoryCache = productsData;
                    await AsyncStorage.setItem(namer.storage.products, JSON.stringify(productsData));
                } else {
                    // No valid products data
                    this.productsMemoryCache = null;
                    await AsyncStorage.removeItem(namer.storage.products);
                    console.log("getProducts removed - no valid data");
                }

                return this.productsMemoryCache;
            } catch (error) {
                console.error("Error fetching getProducts:", error);
                // Reset promise on error to allow future retries
                this.productsLoadingPromise = null;
                throw error;
            }
        })();

        return this.productsLoadingPromise;
    }




    // mapper data
    private static mapperMemoryCache: any = null;
    private static mapperLoadingPromise: Promise<any> | null = null;
    // getWhat = ["intent","gender","interests"]
    public static getMapper = (forceRefresh = false, getWhat: string[] = []): Promise<any> => {
        // Return from memory cache if available and not forcing refresh
        if (!forceRefresh && this.mapperMemoryCache) { 
            return Promise.resolve(this.mapperMemoryCache);
        }

        // Prevent duplicate concurrent requests
        if (!forceRefresh && this.mapperLoadingPromise) { 
            return this.mapperLoadingPromise;
        }

        this.mapperLoadingPromise = (async () => {
            try {
                // Check AsyncStorage cache if not forcing refresh
                if (!forceRefresh) {
                    try {
                        const cachedMapper = await AsyncStorage.getItem(namer.storage.mapper);
                        if (cachedMapper) { 
                            this.mapperMemoryCache = JSON.parse(cachedMapper);
                            return this.mapperMemoryCache ;
                        }
                    } catch (error) {
                        console.error("Error reading mapper from AsyncStorage:", error);
                    }
                }

                const response = await _http_request({
                    customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getMapper',
                    reqType: 'POST',
                    headerArray: {
                        'Content-Type': 'application/json',
                        'Accept-Encoding': 'identity'
                    },
                    bodyArray: {}
                });

                const mapperData = response?.data?.mapper_payload ?? response?.mapper_payload;

                if (response?.code === 200 && mapperData && Object.keys(mapperData).length > 0) {
                    this.mapperMemoryCache = {
                        ...(this.mapperMemoryCache ?? {}),
                        ...mapperData
                    };
                    await AsyncStorage.setItem(namer.storage.mapper  , JSON.stringify(this.mapperMemoryCache));
                } else {
                    this.mapperMemoryCache = this.mapperMemoryCache ?? null;
                    if (!this.mapperMemoryCache) await AsyncStorage.removeItem(namer.storage.mapper  );
                    console.log("getMapper removed - no valid data");
                }

                return this.mapperMemoryCache;
            } catch (error) {
                console.error("Error fetching getMapper:", error);
                this.mapperLoadingPromise = null;
                throw error;
            }
        })();

        return this.mapperLoadingPromise  ;
    }



    // Full mapper payload: every mapping_lookup row keyed by map_type, e.g. __MAPPER.bio_gender
    private static tempMapper: any = null;
    public static CONFIG = {
        get: (): { mapper: any } => {
            return { mapper: cacheStorage.tempMapper };
        },
        getMapper: async (): Promise<void> => {
            const sessIdStorage = await AsyncStorage.getItem(namer.storage.sessionId);
            if (!sessIdStorage) return;

            const server = await _http_request({
                customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getMapper',
                reqType: "POST",
                bodyArray: {
                    _gpl: true,
                    _bi: true,
                    _gm: true
                }
            });

            if (server?.code === 200) {
                await AsyncStorage.setItem(namer.storage.mapper_payload, JSON.stringify(server?.mapper_payload));
                cacheStorage.tempMapper = server?.mapper_payload;
            } else {
                xxa_logggingReport({ type: "function", extra: server, useraction: "CONFIG.generateFromServer", url: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getMapper', logMessage: "Failed to fetch versioning data" });
            }
        }
    }
}
