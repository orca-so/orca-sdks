import { PublicKey } from "@solana/web3.js";
import { MetaplexHttpClient } from "../src/metadata/client";

const sampleMetadata1 = Buffer.from("BFtPgBm85dopS9rNZwwfyKR/ckQ3Wtibj3XaT2e/MICsyEEWcJXwAK+lN+rJl013aKLNt+DXsGEWdx46Idsv6b4gAAAAT3JjYW5hdXRzICMyOTM0AAAAAAAAAAAAAAAAAAAAAAAKAAAAT1JDQU5BVVQAAMgAAABodHRwczovL2Fyd2VhdmUubmV0LzFmcHRCQnQwd0pJaUJCd1Q4SVJzSjgxSzRVOUpQS0JQcTlDOVBwbjU4Y2cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwBAQQAAAB/XDjW1aOvfsfwlZDQz8Z6g/dsaRpEmcw19IvYgc5l4QEAml6UEsJRfGHX3Z2h6YEIVDK2j9x+ddIy2ebdhCF5skcAAES/tpyc+5d2PmBqnv9xYsngE/am7+MEXf0mQx5uTGaSAADBvCrbgMWOJ2jE7lxd85ewIH0xwp4hKINk5+SJIxYBdABkAQEB/wABAZHCaV2VWTU4CrK3bD+z46tAhWUNhrm4EdHhRW63PQAbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
const sampleMetadata2 = Buffer.from("BOiqde3lG/8XvxD8vqpMr/LUtsZXBktLyzJ7KHzueYU3dN1qU/cb69+5ug0Zyl4e3c9wKAa2p56nQirpEtUG8aogAAAAU01CIEdlbjMgIzM5OTEAAAAAAAAAAAAAAAAAAAAAAAAKAAAAAAAAAAAAAAAAAMgAAABodHRwczovL25mdHN0b3JhZ2UubGluay9pcGZzL2JhZnliZWlmbjV4dHZzdGI0dTVka2I2dXdwcDRybW8zcDVmdG5sNWR5ZGNwYWxmYTJybmN1eWltbW15LzM5OTAuanNvbgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPQBAQQAAAD06xKzXd7Ih163wYaNfUCkElt/43PRevP077LIc7TRuAEADQF1NmTDegYttMeeYNFYbH6cROyTNRJ0LdHRtp6txf8AAPo99i5mF81njuJb9ov1e7SDGyp5zUAAlCzUhTVFFCfBAFh10EH7UEZN79gGauZrIaJzBMrHu7AslrlSO+gQdW0nlwAMAQEB/gEEAQFuYXTE9cSHgIzncyjZA79aqs6npiPHSzvGFlxImICC4AAAAQABjwQ2Kt+32Y+KaVsg0zjcNGZY67+8ief3OL1UZE4JuSIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
const sampleMetadata3 = Buffer.from("BFtPgBm85dopS9rNZwwfyKR/ckQ3Wtibj3XaT2e/MICskcJpXZVZNTgKsrdsP7Pjq0CFZQ2GubgR0eFFbrc9ABsgAAAAT3JjYW5hdXRzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKAAAAT1JDQU5BVVQAAMgAAABodHRwczovL2Fyd2VhdmUubmV0L3VfcDlWUTBxUWNRSl92ZVpMdndtdTBqZC0ydGRDNlVHam5wdmFtaGZucGMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEAAABbT4AZvOXaKUvazWcMH8ikf3JEN1rYm4912k9nvzCArAFkAAEB/wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
const publicKey = new PublicKey("EUi6zrVQLqMtAZwQ8akyrJkGtBRWxPYK29SD1gGLtgNy")

describe("onchain-metadata", () => {
  const client = new MetaplexHttpClient();

  it("get metadata address", () => {
    const address = client.getMetadataAddress(publicKey);
    expect(address.toString()).toEqual("J5S5ic4maffemW4NLkEuMU3YFcp2hBL5vzjbTdHCc765");
  });

  it("parse onchain metadata 1", () => {
    const metadata = client.parseOnChainMetadata(publicKey, sampleMetadata1);
    expect(metadata?.updateAuthority.toString()).toEqual("79SQqm8SUyLR21cXk5TEGCtkjWnN7NwBjUUY2aYUci8B");
    expect(metadata?.mint.toString()).toEqual("EUi6zrVQLqMtAZwQ8akyrJkGtBRWxPYK29SD1gGLtgNy");
    expect(metadata?.name).toEqual("Orcanauts #2934");
    expect(metadata?.symbol).toEqual("ORCANAUT");
    expect(metadata?.uri).toEqual("https://arweave.net/1fptBBt0wJIiBBwT8IRsJ81K4U9JPKBPq9C9Ppn58cg");
    expect(metadata?.sellerFeeBasisPoints).toEqual(300);

    expect(metadata?.creators?.length).toEqual(4);

    expect(metadata?.creators?.[0]?.address.toString()).toEqual("9aALgDk1Ryx4PQLeeaFRVHpRmR3xUoyFTvR7RVXky23S");
    expect(metadata?.creators?.[0]?.verified).toEqual(true);
    expect(metadata?.creators?.[0]?.share).toEqual(0);

    expect(metadata?.creators?.[1]?.address.toString()).toEqual("BPbS1AC4KW5SBiz8M2AgPtWXTzR1ekBwMLLQLcwdvZnE");
    expect(metadata?.creators?.[1]?.verified).toEqual(false);
    expect(metadata?.creators?.[1]?.share).toEqual(0);

    expect(metadata?.creators?.[2]?.address.toString()).toEqual("5dNGzQh9sonyFUcTHrH6wiCczokUMSc79miMEysyVYjK");
    expect(metadata?.creators?.[2]?.verified).toEqual(false);
    expect(metadata?.creators?.[2]?.share).toEqual(0);

    expect(metadata?.creators?.[3]?.address.toString()).toEqual("E3G6ujBGbusExBAPL5hg62xu5ncWeVh9CLjU9qbusVvs");
    expect(metadata?.creators?.[3]?.verified).toEqual(false);
    expect(metadata?.creators?.[3]?.share).toEqual(100);

    expect(metadata?.primarySaleHappened).toEqual(true);
    expect(metadata?.isMutable).toEqual(true);
    expect(metadata?.editionNonce).toEqual(255);
    expect(metadata?.tokenStandard).toEqual(null);
    expect(metadata?.collection?.verified).toEqual(true);
    expect(metadata?.collection?.key.toString()).toEqual("Aoz4BEWLkwmWXvujkdjH3ozb61VvqJhtFQ49khXj7Lxi");
    expect(metadata?.uses).toEqual(null);
  });

  it("parse onchain metadata 2", () => {
    const metadata = client.parseOnChainMetadata(publicKey, sampleMetadata2);
    expect(metadata?.updateAuthority.toString()).toEqual("GfELr1GA9bLmgiMymUm7h8nDkZLG2Ls6txSsANopeVEW");
    expect(metadata?.mint.toString()).toEqual("8sC7boKrE2v7uebpwruFj2AcRhb98MQm1Ry85PcUuArV");
    expect(metadata?.name).toEqual("SMB Gen3 #3991");
    expect(metadata?.symbol).toEqual("");
    expect(metadata?.uri).toEqual("https://nftstorage.link/ipfs/bafybeifn5xtvstb4u5dkb6uwpp4rmo3p5ftnl5dydcpalfa2rncuyimmmy/3990.json");
    expect(metadata?.sellerFeeBasisPoints).toEqual(500);

    expect(metadata?.creators?.length).toEqual(4);

    expect(metadata?.creators?.[0]?.address.toString()).toEqual("HV4Nvm9zHfNA43JYYkjZu8vwqiuE8bfEhwcKFfyQ65o5");
    expect(metadata?.creators?.[0]?.verified).toEqual(true);
    expect(metadata?.creators?.[0]?.share).toEqual(0);

    expect(metadata?.creators?.[1]?.address.toString()).toEqual("smbBn7Votkw2upiVZtX9WgkmC7fNW2QabfVFuPLhu3C");
    expect(metadata?.creators?.[1]?.verified).toEqual(false);
    expect(metadata?.creators?.[1]?.share).toEqual(0);

    expect(metadata?.creators?.[2]?.address.toString()).toEqual("HqqiyJcm3yWPyzwisRKAQa2bJAj14V837yJRGaxwRFaG");
    expect(metadata?.creators?.[2]?.verified).toEqual(false);
    expect(metadata?.creators?.[2]?.share).toEqual(88);

    expect(metadata?.creators?.[3]?.address.toString()).toEqual("8vttKbtbXaUcCfJdPNnZjMfKMBCnTXsxy96U4WSLSJHU");
    expect(metadata?.creators?.[3]?.verified).toEqual(false);
    expect(metadata?.creators?.[3]?.share).toEqual(12);

    expect(metadata?.primarySaleHappened).toEqual(true);
    expect(metadata?.isMutable).toEqual(true);
    expect(metadata?.editionNonce).toEqual(254);
    expect(metadata?.tokenStandard).toEqual(4);
    expect(metadata?.collection?.verified).toEqual(true);
    expect(metadata?.collection?.key.toString()).toEqual("8Rt3Ayqth4DAiPnW9MDFi63TiQJHmohfTWLMQFHi4KZH");
    expect(metadata?.uses).toEqual(null);
  });

  it("parse onchain metadata 3", () => {
    const metadata = client.parseOnChainMetadata(publicKey, sampleMetadata3);
    expect(metadata?.updateAuthority.toString()).toEqual("79SQqm8SUyLR21cXk5TEGCtkjWnN7NwBjUUY2aYUci8B");
    expect(metadata?.mint.toString()).toEqual("Aoz4BEWLkwmWXvujkdjH3ozb61VvqJhtFQ49khXj7Lxi");
    expect(metadata?.name).toEqual("Orcanauts");
    expect(metadata?.symbol).toEqual("ORCANAUT");
    expect(metadata?.uri).toEqual("https://arweave.net/u_p9VQ0qQcQJ_veZLvwmu0jd-2tdC6UGjnpvamhfnpc");
    expect(metadata?.sellerFeeBasisPoints).toEqual(0);

    expect(metadata?.creators?.length).toEqual(1);

    expect(metadata?.creators?.[0]?.address.toString()).toEqual("79SQqm8SUyLR21cXk5TEGCtkjWnN7NwBjUUY2aYUci8B");
    expect(metadata?.creators?.[0]?.verified).toEqual(true);
    expect(metadata?.creators?.[0]?.share).toEqual(100);

    expect(metadata?.primarySaleHappened).toEqual(false);
    expect(metadata?.isMutable).toEqual(true);
    expect(metadata?.editionNonce).toEqual(255);
    expect(metadata?.tokenStandard).toEqual(0);
    expect(metadata?.collection).toEqual(null);
    expect(metadata?.uses).toEqual(null);
  });

});
