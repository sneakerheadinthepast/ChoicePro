// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FHEVM Interface
 * @author Zama
 * @dev This interface provides the necessary function signatures and data types
 * to interact with the FHEVM (Fully Homomorphic Encryption Virtual Machine).
 * It allows smart contracts to perform computations on encrypted data without
 * ever decrypting it on-chain. The `euint` types represent encrypted integers.
 */
interface FHEVM {
    // FHE data types
    type euint4 is uint256;
    type euint8 is uint256;
    type euint16 is uint256;
    type euint32 is uint256;
    type euint64 is uint256;
    type euint128 is uint256;
    type euint256 is uint256;
    type ebool is uint256;

    // FHE operations
    function add(euint32 a, euint32 b) external pure returns (euint32);
    function add(euint32 a, uint32 b) external pure returns (euint32);
    function sub(euint32 a, euint32 b) external pure returns (euint32);
    function sub(euint32 a, uint32 b) external pure returns (euint32);
    function mul(euint32 a, euint32 b) external pure returns (euint32);
    function mul(euint32 a, uint32 b) external pure returns (euint32);
    function div(euint32 a, euint32 b) external pure returns (euint32);
    function rem(euint32 a, euint32 b) external pure returns (euint32);
    function neg(euint32 a) external pure returns (euint32);

    // Bitwise operations
    function and(euint32 a, euint32 b) external pure returns (euint32);
    function or(euint32 a, euint32 b) external pure returns (euint32);
    function xor(euint32 a, euint32 b) external pure returns (euint32);
    function not(euint32 a) external pure returns (euint32);
    function shl(euint32 a, euint32 b) external pure returns (euint32);
    function shl(euint32 a, uint32 b) external pure returns (euint32);
    function shr(euint32 a, euint32 b) external pure returns (euint32);
    function shr(euint32 a, uint32 b) external pure returns (euint32);
    function rotl(euint32 a, euint32 b) external pure returns (euint32);
    function rotr(euint32 a, euint32 b) external pure returns (euint32);

    // Comparison operations
    function eq(euint32 a, euint32 b) external pure returns (ebool);
    function eq(euint32 a, uint32 b) external pure returns (ebool);
    function ne(euint32 a, euint32 b) external pure returns (ebool);
    function ne(euint32 a, uint32 b) external pure returns (ebool);
    function gt(euint32 a, euint32 b) external pure returns (ebool);
    function gt(euint32 a, uint32 b) external pure returns (ebool);
    function ge(euint32 a, euint32 b) external pure returns (ebool);
    function ge(euint32 a, uint32 b) external pure returns (ebool);
    function lt(euint32 a, euint32 b) external pure returns (ebool);
    function lt(euint32 a, uint32 b) external pure returns (ebool);
    function le(euint32 a, euint32 b) external pure returns (ebool);
    function le(euint32 a, uint32 b) external pure returns (ebool);

    // Selection
    function select(ebool cond, euint32 a, euint32 b) external pure returns (euint32);

    // Encryption and Decryption
    function trivialEncrypt(uint32 value) external pure returns (euint32);
    function decrypt(euint32 ciphertext) external view returns (uint32);

    // Re-encryption for viewing by others
    function reencrypt(euint32 ciphertext, bytes32 publicKey) external view returns (euint32);
}

/**
 * @title FHEConfidentialVoting
 * @author zama
 * @notice A smart contract for conducting confidential voting using Fully Homomorphic Encryption (FHE).
 * It allows for the creation of proposals, casting of encrypted votes, and secure tallying
 * where vote counts are only decrypted after the voting period has ended.
 */
contract FHEConfidentialVoting {
    // Using FHEVM types and functions
    using FHEVM for FHEVM.euint32;
    using FHEVM for FHEVM.ebool;

    // Address of the FHEVM precompile contract
    FHEVM constant FHE = FHEVM(0x000000000000000000000000000000000000005d);

    // Struct to define a single voting option within a proposal.
    struct ProposalOption {
        string name;
        FHEVM.euint32 encryptedVoteCount; // Votes are tallied homomorphically
    }

    // Struct to represent a complete voting proposal.
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        uint256 votingDeadline;
        bool resultsDecrypted;
        ProposalOption[] options;
        uint32[] decryptedResults; // Results are stored here after tallying
    }

    // State Variables
    uint256 private _nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public hasVoted;

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint256 votingDeadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter);
    event TallyCompleted(uint256 indexed proposalId, uint32[] results);

    // Custom Errors
    error ProposalNotFound(uint256 proposalId);
    error VotingIsClosed(uint256 proposalId);
    error AlreadyVoted(address voter, uint256 proposalId);
    error InvalidOptionsCount(uint256 provided, uint256 expected);
    error TallyNotAllowed(uint256 proposalId);
    error ResultsAlreadyDecrypted(uint256 proposalId);

    /**
     * @notice Initializes the contract, setting the first proposal ID to 1.
     */
    constructor() {
        _nextProposalId = 1;
    }

    /**
     * @notice Creates a new voting proposal.
     * @param _title The title or question of the proposal.
     * @param _optionNames An array of strings representing the voting options (e.g., ["Yes", "No", "Abstain"]).
     * @param _votingDurationSeconds The duration of the voting period in seconds from the time of creation.
     * @return The ID of the newly created proposal.
     */
    function createProposal(
        string calldata _title,
        string[] calldata _optionNames,
        uint256 _votingDurationSeconds
    ) external returns (uint256) {
        uint256 proposalId = _nextProposalId++;
        uint256 deadline = block.timestamp + _votingDurationSeconds;

        proposals[proposalId].id = proposalId;
        proposals[proposalId].proposer = msg.sender;
        proposals[proposalId].title = _title;
        proposals[proposalId].votingDeadline = deadline;

        // Initialize options with encrypted vote count of 0
        for (uint256 i = 0; i < _optionNames.length; i++) {
            proposals[proposalId].options.push(
                ProposalOption({
                    name: _optionNames[i],
                    encryptedVoteCount: FHE.trivialEncrypt(0)
                })
            );
        }

        emit ProposalCreated(proposalId, msg.sender, _title, deadline);
        return proposalId;
    }

    /**
     * @notice Casts an encrypted vote on a specific proposal.
     * @dev The caller must provide an array of FHE-encrypted integers (`euint32`).
     * Each integer in the array corresponds to an option. Typically, one of these
     * will be an encryption of `1` (the vote) and the others will be encryptions of `0`.
     * The contract then homomorphically adds these encrypted votes to the running tallies.
     * @param _proposalId The ID of the proposal to vote on.
     * @param _encryptedVotes An array of encrypted votes (e.g., [FHE.encrypt(1), FHE.encrypt(0)]).
     */
    function castVote(uint256 _proposalId, FHEVM.euint32[] calldata _encryptedVotes) external {
        if (proposals[_proposalId].id == 0) revert ProposalNotFound(_proposalId);
        if (block.timestamp > proposals[_proposalId].votingDeadline) revert VotingIsClosed(_proposalId);
        if (hasVoted[msg.sender][_proposalId]) revert AlreadyVoted(msg.sender, _proposalId);
        if (_encryptedVotes.length != proposals[_proposalId].options.length)
            revert InvalidOptionsCount(_encryptedVotes.length, proposals[_proposalId].options.length);

        Proposal storage p = proposals[_proposalId];

        // Homomorphically add the encrypted votes to the tallies
        for (uint256 i = 0; i < _encryptedVotes.length; i++) {
            p.options[i].encryptedVoteCount = FHE.add(p.options[i].encryptedVoteCount, _encryptedVotes[i]);
        }

        hasVoted[msg.sender][_proposalId] = true;
        emit VoteCast(_proposalId, msg.sender);
    }

    /**
     * @notice Tallies the votes for a proposal after the voting deadline has passed.
     * @dev This function can only be called once per proposal. It iterates through
     * each option, decrypts the final homomorphically-computed tally, and stores
     * the plaintext result.
     * @param _proposalId The ID of the proposal to tally.
     */
    function tallyVotes(uint256 _proposalId) external {
        if (proposals[_proposalId].id == 0) revert ProposalNotFound(_proposalId);
        if (block.timestamp <= proposals[_proposalId].votingDeadline) revert TallyNotAllowed(_proposalId);
        if (proposals[_proposalId].resultsDecrypted) revert ResultsAlreadyDecrypted(_proposalId);

        Proposal storage p = proposals[_proposalId];
        uint32[] memory results = new uint32[](p.options.length);

        // Decrypt the final count for each option
        for (uint256 i = 0; i < p.options.length; i++) {
            results[i] = FHE.decrypt(p.options[i].encryptedVoteCount);
        }

        p.decryptedResults = results;
        p.resultsDecrypted = true;

        emit TallyCompleted(_proposalId, results);
    }

    /**
     * @notice Retrieves the details of a proposal.
     * @param _proposalId The ID of the proposal.
     * @return A memory struct containing the proposal's public information.
     */
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        if (proposals[_proposalId].id == 0) revert ProposalNotFound(_proposalId);
        return proposals[_proposalId];
    }

    /**
     * @notice Retrieves the final decrypted results for a proposal.
     * @dev Will revert if the results have not yet been tallied and decrypted.
     * @param _proposalId The ID of the proposal.
     * @return An array of plaintext vote counts.
     */
    function getDecryptedResults(uint256 _proposalId) external view returns (uint32[] memory) {
        if (proposals[_proposalId].id == 0) revert ProposalNotFound(_proposalId);
        if (!proposals[_proposalId].resultsDecrypted) revert TallyNotAllowed(_proposalId);
        return proposals[_proposalId].decryptedResults;
    }
}